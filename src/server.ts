import { routeAgentRequest, getAgentByName, type Schedule } from "agents";

import { unstable_getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  type ToolSet,
  type CoreMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls } from "./utils";
import { tools, executions } from "./tools";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { AGENT_NAMES } from "./constants";
import type { McpToolArgs } from "./types";
// import { env } from "cloudflare:workers";

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

// we use ALS to expose the agent context to the tools
// export const agentContext = new AsyncLocalStorage<Chat>();
/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  // Flag to track if auto-analysis has been triggered for current session
  private autoAnalysisTriggered = false;

  // Override broadcast to handle WebSocket errors gracefully
  broadcast(message: string, exclude?: string[]) {
    try {
      return super.broadcast(message, exclude);
    } catch {
      // Continue execution - don't let WebSocket errors break the agent
    }
  }

  // Override onError to handle server errors gracefully
  onError(connectionOrError: any, error?: unknown) {
    if (arguments.length === 1) {
      if (
        connectionOrError?.message?.includes("WebSocket") ||
        connectionOrError?.message?.includes("state")
      ) {
        return; // Silently handle WebSocket errors
      }
      console.error("Chat agent error:", connectionOrError);
    } else {
      if (
        error?.toString()?.includes("WebSocket") ||
        error?.toString()?.includes("state")
      ) {
        return; // Silently handle WebSocket errors
      }
      console.error("Connection error:", error);
    }
    // For other errors, let the default handler deal with it
    try {
      super.onError?.(connectionOrError, error);
    } catch {
      // Ignore parent error handler errors
    }
  }

  // Define use_prompt tool as class property
  private usePromptTool = {
    use_prompt: {
      description: "Use an MCP prompt with provided arguments",
      parameters: z.object({
        name: z.string().describe("Prompt name"),
        serverId: z.string().describe("Server ID"),
        arguments: z.record(z.any()).optional().describe("Prompt arguments"),
      }),
      execute: async (args: McpToolArgs) => {
        try {
          // @ts-ignore - Temporary workaround for getPrompt typing issue
          const result = await this.mcp.getPrompt({
            name: args.name,
            serverId: args.serverId,
            arguments: args.arguments || {},
          });

          // getPrompt executed successfully
          return result;
        } catch (error) {
          const errorMsg = (error as Error).message;
          if (errorMsg.includes("Invalid arguments")) {
            return {
              error: `Prompt "${args.name}" requires different arguments`,
              suggestion:
                "Check server documentation for correct argument structure",
            };
          }

          return { error: errorMsg };
        }
      },
    },
  };

  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Collect and filter MCP tools
    const mcpTools = this.mcp.unstable_getAITools();

    // Collect all prompts from MCP servers
    const mcpPrompts = this.mcp.listPrompts();

    // Generate prompts context for the system message
    const promptsContext =
      mcpPrompts.length > 0
        ? `\n\nAvailable MCP Prompts:\n${mcpPrompts.map((p) => `- ${p.name}: ${p.description || "No description"}`).join("\n")}`
        : "";

    // Booking analysis tools for medical equipment analysis
    const bookingAnalysisTools = {
      generateBookingTemplates: {
        description:
          "Generate booking templates for each customer based on their most common patterns",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              AGENT_NAMES.MAIN_ANALYZER
            );
            return await (bookingAgent as any).generateCommonBookingTemplates();
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.generateCommonBookingTemplates:",
              error
            );
            return { error: (error as Error).message };
          }
        },
      },

      getRecommendedBooking: {
        description:
          "Get a complete booking request body template for a customer based on their usual booking patterns, or find templates by surgeon. Use this when user asks to create a booking for a specific customer or surgeon.",
        parameters: z.object({
          customerName: z
            .string()
            .optional()
            .describe("Customer name or ID to look up"),
          surgeon: z
            .string()
            .optional()
            .describe("Surgeon name to look up templates for"),
          surgeryDate: z
            .string()
            .optional()
            .describe(
              "Surgery date (e.g., 'tomorrow', 'next week', 'next month', 'next year', '2024-01-15')"
            ),
          notes: z
            .string()
            .optional()
            .describe("Additional notes for the booking"),
          isDraft: z
            .boolean()
            .optional()
            .describe("Whether to create as draft (default: true)"),
        }),
        execute: async (args: {
          customerName?: string;
          surgeon?: string;
          surgeryDate?: string;
          surgeryTime?: string;
          notes?: string;
          isDraft?: boolean;
        }) => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              AGENT_NAMES.MAIN_ANALYZER
            );
            return await (bookingAgent as any).generateBookingRequest(
              args.customerName,
              {
                surgeon: args.surgeon,
                surgeryDate: args.surgeryDate,
                notes: args.notes,
                isDraft: args.isDraft,
              }
            );
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.generateBookingRequest:",
              error
            );
            return { error: (error as Error).message };
          }
        },
      },

      executeBookingAnalysis: {
        description:
          "Execute booking analysis directly from MCP getBooking tool",
        parameters: z.object({}),
        execute: async () => {
          try {
            // Find booking tool using helper method
            const bookingToolInfo = this.findBookingTool();
            if (!bookingToolInfo) {
              console.warn(
                "⚠️ No booking tool found on any connected MCP server"
              );
              return {
                success: false,
                message: "No MCP booking tool available",
              };
            }

            const { tool: bookingTool, serverId: targetServerId } =
              bookingToolInfo;

            // Use Chat agent's MCP client to call the tool
            const mcpResult = await this.mcp.callTool({
              serverId: targetServerId,
              name: bookingTool.name,
              arguments: {
                customQuery: "$expand=items",
                page: 1,
                pageSize: 10,
              },
            });

            console.log("📊 MCP booking result received:");
            console.log("Type:", typeof mcpResult);
            console.log(
              "Keys:",
              mcpResult && typeof mcpResult === "object"
                ? Object.keys(mcpResult)
                : "N/A"
            );
            console.log("Full result:", JSON.stringify(mcpResult, null, 2));

            // Process the result and send to BookingAnalysisAgent for analysis
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              AGENT_NAMES.MAIN_ANALYZER
            );

            // Extract booking data using helper method
            const bookingData = this.extractBookingData(mcpResult);

            if (bookingData.length > 0) {
              // Send the booking data directly to AI BookingAnalysisAgent for processing
              const analysisResult =
                await bookingAgent.setBookings(bookingData);
              return {
                ...analysisResult,
                source: "mcp",
                toolUsed: bookingTool.name,
                message: `Successfully analyzed ${bookingData.length} bookings from MCP`,
              };
            } else {
              return {
                success: false,
                message: "No booking data received from MCP tool",
              };
            }
          } catch (error) {
            console.error("Error executing booking analysis:", error);
            return { error: (error as Error).message };
          }
        },
      },
      getCachedTemplates: {
        description:
          "Get the cached booking templates that were previously generated",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              AGENT_NAMES.MAIN_ANALYZER
            );
            return await (bookingAgent as any).getCachedTemplates();
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.getCachedTemplates:",
              error
            );
            return { error: (error as Error).message };
          }
        },
      },
    };

    const allTools = {
      ...mcpTools,
      ...this.usePromptTool,
      ...bookingAnalysisTools,
    };

    // Create a streaming response that handles both text and tool outputs
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: this.messages,
          dataStream,
          tools: allTools,
          executions: {},
        });

        // Stream the AI response using GPT-4
        const result = streamText({
          model,
          system: `You are a helpful assistant for MyMediset medical equipment booking system. You can analyze images, manage bookings, and help with various tasks.

          ## Current Context
          Today's Date: ${new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}

          ## Booking Creation Workflow
          When user requests "create booking for [Customer] usuals" or similar:
          1. FIRST: Use getRecommendedBooking tool to fetch the customer's booking template with any customizations
          2. If user did not specify any customer or surgeon, use the getCachedTemplates tool to fetch the cached templates.
          3. Show the getRecommendedBooking response.requestBody in a clear, readable format.
          4. Ask if they want to modify anything (times, dates, equipment) before creating the booking
          5. If user specify the date of surgery like tomorrow,next week,next month or next year. Do interpret the date and set the date in the requestBody.
          6. If they confirm or make modifications, use the appropriate MCP createBooking tool with the COMPLETE requestBody from getRecommendedBooking response
          7. CRITICAL: Pass the EXACT requestBody object from getRecommendedBooking response directly to createBooking - do not add, remove, or modify ANY fields
          8. NEVER create your own request object - ALWAYS use the complete requestBody from getRecommendedBooking AS-IS
          9. DO NOT add any additional fields like poNumber, telephone, bookingStatus, releaseDate, estimatedValue - use ONLY what's in the requestBody
          10. The requestBody from getRecommendedBooking includes ALL required fields: customerId, notes, currency, surgeryType, description, isSimulation, collectionDate, reservationType, surgeryDescription
          11. Proceed with simulation true and return the booking creation result to the user, do include status of isAvaliable 
          12. Inform customer about isAvailable and would like to proceed with booking simulation false?
          13. IMPORTANT: After any booking operation (create/update), display results in a structured booking-result block format

          ## Structured Response Format
          
          ### For Booking Operations
          For booking operation results, always use this comprehensive markdown format:
          \`\`\`booking-result
          status: success|error|warning
          bookingId: [generated booking ID]
          customer: [customer name]
          customerId: [customer ID number]
          message: [success/error message]
          equipment: [equipment description]
          surgeon: [surgeon name]
          salesRep: [sales representative name]
          surgeryDate: [surgery date]
          surgeryType: [OR/etc]
          currency: [EUR/USD/etc]
          reservationType: [01/02/etc]
          simulation: [True/False]
          availability: [availability status]
          items:
          [Item Name] (Quantity: [number])
          [Item Name] (Quantity: [number])
          notes: [additional notes]
          \`\`\`
          
          ### For Booking-Related Tools (getRecommendedBooking)
          For getRecommendedBooking, use the booking-result format since it provides complete booking information:
          \`\`\`booking-result
          status: success
          message: Booking template generated
          customer: [customer name]
          customerId: [customer ID]
          equipment: [equipment description]
          surgeon: [surgeon name]
          salesRep: [sales representative]
          surgeryDate: [surgery date]
          surgeryType: [OR/etc]
          currency: [EUR/USD/etc]
          reservationType: [01/02/etc]
          simulation: [True/False]
          items:
          [Item Name] (Quantity: [number])
          [Item Name] (Quantity: [number])
          notes: [additional notes]
          \`\`\`
          
          ### For Template Operations (getCachedTemplates)
          For getCachedTemplates, use the booking-result format for each template (creates multiple cards):
          \`\`\`booking-result
          status: success
          message: Template Retrieved
          customer: [hospital/clinic name]
          template: [template name]
          surgeon: [surgeon name]
          salesRep: [sales rep]
          frequency: [frequency]
          [other template details...]
          \`\`\`
          
          ### For All Other Tool Operations
          For other tool execution (analytics, etc.), use this format:
          \`\`\`tool-result
          tool: [tool name]
          status: success|error|info
          title: [descriptive title]
          [key]: [value]
          [key]: [value]
          \`\`\`
          
          Examples:
          \`\`\`tool-result
          tool: getCachedTemplates
          status: success
          title: Cached Booking Templates Retrieved
          count: 2
          templates:
          - ROYAL PRINCE ALFRED HOSPITAL: Trauma Surgery Set
            - Surgeon: Dr Stephen Hawkins
            - Sales Rep: Muhammad Hidayah
            - Reservation Type: 01
            - Frequency: 1
            - Total Bookings: 1
          - MEDICLINIC PARKVIEW HOSPITAL: Spinal Fusion Set
            - Surgeon: Dr Stephen Hawkins
            - Sales Rep: Muhammad Hidayah
            - Reservation Type: 01
            - Frequency: 8
            - Total Bookings: 9
          \`\`\`
          
          \`\`\`tool-result
          tool: getRecommendedBooking
          status: success
          title: Booking Recommendation Generated
          customer: HOSPITAL NAME
          surgeon: Dr Stephen Hawkins
          equipment: Cranial Kit
          itemCount: 5
          \`\`\`

          ## Available Tools
          - getRecommendedBooking: Fetches customer's booking template with customizations (date, time, notes)
          - generateBookingTemplates: Creates templates from historical booking analysis
          - executeBookingAnalysis: Analyzes booking data from MCP servers
          - MCP tools: Various tools from connected servers (createBooking, getBooking, etc.)

          ## Example Interactions
          User: "create John's usual booking at tomorrow"
          → Use getRecommendedBooking with customerName="John", surgeryDate="tomorrow"
          → Show the generated request body details
          → Ask for confirmation
          → If confirmed, use createBooking MCP tool with the exact requestBody from getRecommendedBooking response
          
          CRITICAL EXAMPLE:
          ✅ CORRECT: Use complete requestBody from getRecommendedBooking
          const templateResult = await getRecommendedBooking({customerName: "John"});
          await createBooking(templateResult.requestBody);  // ← Use entire requestBody object
          
          ❌ WRONG: Never reconstruct the request
          await createBooking({customer: "John", items: [{...}]}); // ← Never do this

          This is the list of available MCP prompts: ${promptsContext}
          
          IMPORTANT: 
          - Only use MCP prompts when the user explicitly asks for them by name or function
          - For booking creation, ALWAYS show the template first before creating
          - Be helpful in explaining booking details and offering modifications
          - For general image analysis or conversation, respond directly using your built-in capabilities
          - After booking operations (createBooking, updateBooking), ALWAYS use the booking-result markdown format
          - After booking-related operations (getRecommendedBooking, getCachedTemplates), ALWAYS use the booking-result markdown format  
          - After all other tool operations (analytics), use the tool-result markdown format`,
          messages: processedMessages,
          tools: allTools,
          experimental_telemetry: {
            isEnabled: true,
          },
          onFinish: async (args: any) => {
            try {
              onFinish(
                args as Parameters<StreamTextOnFinishCallback<ToolSet>>[0]
              );
            } catch (finishError) {
              console.error("🚨 Error in onFinish callback:", finishError);
            }
          },
          onError: (error: any) => {
            console.error("🚨 Error while streaming:", error);
          },
          maxSteps: 10,
        });

        // Merge the AI response stream with tool execution outputs
        result.mergeIntoDataStream(dataStream);
      },
    });

    return dataStreamResponse;
  }

  // Helper method to extract booking data from MCP result
  private extractBookingData(mcpResult: any): any[] {
    if (!mcpResult || typeof mcpResult !== "object") return [];

    // Handle direct array
    if (Array.isArray(mcpResult)) return mcpResult;

    // Handle MCP content structure: { content: [{ type: "text", text: "..." }] }
    if (mcpResult.content && Array.isArray(mcpResult.content)) {
      for (const item of mcpResult.content) {
        if (item.type === "text" && item.text) {
          try {
            const parsed = JSON.parse(item.text);
            if (parsed.bookings && Array.isArray(parsed.bookings))
              return parsed.bookings;
            if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
            if (Array.isArray(parsed)) return parsed;
          } catch (parseError) {
            console.warn("⚠️ Failed to parse booking content:", parseError);
          }
        }
      }
    }

    // Handle direct .data or .bookings property
    if (mcpResult.data && Array.isArray(mcpResult.data)) return mcpResult.data;
    if (mcpResult.bookings && Array.isArray(mcpResult.bookings))
      return mcpResult.bookings;

    return [];
  }

  // Helper method to find booking tool from available MCP servers
  private findBookingTool(): { tool: any; serverId: string } | null {
    const mcpState = this.getMcpServers();
    const servers = mcpState.servers || {};

    for (const [serverId, serverData] of Object.entries(servers)) {
      if (
        serverData &&
        typeof serverData === "object" &&
        "state" in serverData &&
        serverData.state === "ready"
      ) {
        try {
          const serverTools = this.mcp.listTools();

          const bookingTool = serverTools.find(
            (tool: any) =>
              tool.name &&
              (tool.name.toLowerCase().includes("booking") ||
                tool.name.toLowerCase().includes("getbooking"))
          );

          if (bookingTool) {
            console.log(
              `✅ Found booking tool "${bookingTool.name}" on server ${serverId}`
            );
            return { tool: bookingTool, serverId };
          }
        } catch (toolListError) {
          console.warn(
            `⚠️ Could not list tools for server ${serverId}:`,
            toolListError
          );
        }
      }
    }
    return null;
  }

  // Internal method to execute booking analysis (for auto-triggering)
  private async executeBookingAnalysisInternal() {
    try {
      console.log("🔧 Starting internal booking analysis");

      // Find booking tool using helper method
      const bookingToolInfo = this.findBookingTool();
      if (!bookingToolInfo) {
        console.warn("⚠️ No booking tool found on any connected MCP server");
        return {
          success: false,
          message: "No MCP booking tool available",
        };
      }

      const { tool: bookingTool, serverId: targetServerId } = bookingToolInfo;

      console.log("🔄 Executing booking tool...");
      console.log(
        `📡 Calling tool: ${bookingTool.name} on server: ${targetServerId}`
      );

      // Use Chat agent's MCP client to call the tool
      const mcpResult = await this.mcp.callTool({
        serverId: targetServerId,
        name: bookingTool.name,
        arguments: {
          customQuery: "$expand=items",
          page: 1,
          pageSize: 10,
        },
      });

      console.log("📊 MCP booking result received:");
      console.log("Type:", typeof mcpResult);
      console.log(
        "Keys:",
        mcpResult && typeof mcpResult === "object"
          ? Object.keys(mcpResult)
          : "N/A"
      );
      console.log("Full result:", JSON.stringify(mcpResult, null, 2));

      // Process the result and send to BookingAnalysisAgent for analysis
      const bookingAgent = await getAgentByName(
        this.env.BookingAnalysisAgent,
        "main-analyzer"
      );

      // Extract booking data using helper method
      const bookingData = this.extractBookingData(mcpResult);
      console.log("📊 Extracted", bookingData.length, "bookings from MCP");

      if (bookingData.length > 0) {
        // Send the booking data directly to AI BookingAnalysisAgent for processing
        const analysisResult = await bookingAgent.setBookings(bookingData);
        return {
          ...analysisResult,
          source: "mcp",
          toolUsed: bookingTool.name,
          message: `Successfully analyzed ${bookingData.length} bookings from MCP`,
          autoTriggered: true,
        };
      } else {
        return {
          success: false,
          message: "No booking data received from MCP tool",
        };
      }
    } catch (error) {
      console.error("Error executing internal booking analysis:", error);
      return { error: (error as Error).message };
    }
  }

  async onRequest(request: Request): Promise<Response> {
    const reqUrl = new URL(request.url);

    // Handle listing MCP servers
    if (reqUrl.pathname.endsWith("list-mcp") && request.method === "GET") {
      try {
        console.log("🔍 Starting MCP servers list request");

        // Check database and MCP state with better error handling
        let dbServers = [];
        try {
          dbServers = this.sql`SELECT * FROM cf_agents_mcp_servers`;
          console.log("📊 Database has", dbServers.length, "stored servers");
        } catch (dbError) {
          console.warn("⚠️ Database query failed:", dbError);
          // Continue without database info
        }

        // Get MCP servers with error handling
        let actualServers = {};
        try {
          const mcpState = this.getMcpServers();
          actualServers = mcpState?.servers || {};
          console.log("📋 Available server IDs:", Object.keys(actualServers));
        } catch (mcpError) {
          console.warn("⚠️ getMcpServers failed:", mcpError);
          // Continue with empty servers
        }

        // Auto-trigger booking analysis once when servers are confirmed connected
        if (
          !this.autoAnalysisTriggered &&
          dbServers.length > 0 &&
          Object.keys(actualServers).length > 0
        ) {
          this.autoAnalysisTriggered = true;
          console.log(
            "🚀 One-time auto-trigger: MCP servers confirmed connected"
          );
          // Use setTimeout to avoid blocking the list response
          setTimeout(async () => {
            try {
              await this.executeBookingAnalysisInternal();
              console.log("✅ One-time auto booking analysis completed");
            } catch (error) {
              console.warn("⚠️ One-time auto booking analysis failed:", error);
            }
          }, 1000);
        }

        return new Response(
          JSON.stringify({ success: true, servers: actualServers }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("❌ Error listing MCP servers:", error);
        console.error(
          "❌ Error stack:",
          error instanceof Error ? error.stack : "No stack"
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            servers: {},
          }),
          {
            status: 200, // Return 200 with error info instead of 500
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle removing MCP servers (disconnect + delete from database)
    if (reqUrl.pathname.endsWith("remove-mcp") && request.method === "POST") {
      try {
        const { serverId } = (await request.json()) as { serverId: string };
        console.log("🗑️ Removing MCP server completely:", serverId);

        const mcpState = this.getMcpServers();
        const actualServers = mcpState.servers || {};
        console.log("📋 Available connections:", Object.keys(actualServers));

        // First disconnect if connected
        if (actualServers[serverId as keyof typeof actualServers]) {
          try {
            await this.mcp.closeConnection(serverId);
            console.log("✅ MCP server disconnected:", serverId);
          } catch (disconnectError) {
            console.warn(
              "⚠️ Error disconnecting (but continuing with removal):",
              disconnectError
            );
          }
        }

        // Remove from persistent storage (database) using direct SQL approach
        try {
          // Use direct SQL deletion like force-clear-mcp-db for consistency
          this.sql`DELETE FROM cf_agents_mcp_servers WHERE id = ${serverId}`;
          console.log("✅ MCP server removed from database via SQL:", serverId);

          // Verify the deletion worked
          const remainingServers = this
            .sql`SELECT COUNT(*) as count FROM cf_agents_mcp_servers WHERE id = ${serverId}`;
          const remainingCount =
            remainingServers.length > 0 ? remainingServers[0].count : 0;
          console.log(
            "📊 Remaining instances of server in DB:",
            remainingCount
          );

          // Also try the framework method as fallback
          try {
            await this.removeMcpServer(serverId);
            console.log("✅ Framework removal also called for:", serverId);
          } catch (frameworkError) {
            console.warn(
              "⚠️ Framework removal failed (SQL deletion succeeded):",
              frameworkError
            );
          }
        } catch (removeError) {
          console.warn("⚠️ Error removing from database:", removeError);
        }

        // Reset booking analysis and auto-trigger flag when MCP server is deleted
        try {
          const bookingAgent = await getAgentByName(
            this.env.BookingAnalysisAgent,
            AGENT_NAMES.MAIN_ANALYZER
          );
          await bookingAgent.setBookings([]);
          this.autoAnalysisTriggered = false;
          console.log(
            "✅ Booking analysis and auto-trigger flag reset after MCP server removal"
          );
        } catch (resetError) {
          console.warn("⚠️ Failed to reset booking analysis:", resetError);
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error removing MCP server:", error);
        return new Response(
          JSON.stringify({ success: false, error: (error as Error).message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle disconnecting MCP servers (disconnect only, keep in database)
    if (
      reqUrl.pathname.endsWith("disconnect-mcp") &&
      request.method === "POST"
    ) {
      try {
        const { serverId } = (await request.json()) as { serverId: string };
        console.log("🔌 Attempting to disconnect MCP server:", serverId);

        const mcpState = this.getMcpServers();
        const actualServers = mcpState.servers || {};
        console.log("📋 Available connections:", Object.keys(actualServers));

        if (!actualServers[serverId as keyof typeof actualServers]) {
          console.warn("⚠️ Connection not found:", serverId);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Connection "${serverId}" not found`,
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        await this.mcp.closeConnection(serverId);
        console.log("✅ MCP server disconnected:", serverId);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error disconnecting MCP server:", error);
        return new Response(
          JSON.stringify({ success: false, error: (error as Error).message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    if (reqUrl.pathname.endsWith("add-mcp") && request.method === "POST") {
      try {
        const mcpServer = (await request.json()) as {
          url: string;
          name: string;
        };
        console.log("➕ Adding MCP server:", mcpServer.name);

        const host = reqUrl.origin;
        const callbackHost = `${host}`;

        const result = await this.addMcpServer(
          mcpServer.name,
          mcpServer.url,
          callbackHost
        );
        console.log("✅ MCP server added successfully");

        return new Response(
          JSON.stringify({
            success: true,
            result,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Handle OAuth callback (commented out for testing - frontend SDK handles OAuth)
    // if (reqUrl.pathname.endsWith("oauth/callback")) {
    //   console.log("🔥 OAUTH CALLBACK ROUTE HIT!");
    //   console.log("🔗 Full URL:", reqUrl.href);
    //   console.log("🛤️ Pathname:", reqUrl.pathname);
    //   console.log("📋 Search params:", reqUrl.search);
    //
    //   try {
    //     const code = reqUrl.searchParams.get("code");
    //     const state = reqUrl.searchParams.get("state");
    //
    //     console.log("🔑 Authorization code:", code);
    //     console.log("🏷️ State parameter:", state);

    //     if (!code) {
    //       console.log("❌ Missing authorization code");
    //       return new Response("Missing authorization code", { status: 400 });
    //     }

    //     // Let the MCP manager handle the token exchange
    //     console.log("🔄 Calling mcp.handleCallbackRequest...");
    //     await this.mcp.handleCallbackRequest(request);
    //     console.log("✅ OAuth callback handled successfully");

    //     return new Response(JSON.stringify({ status: "success" }), {
    //       status: 200,
    //       headers: { "Content-Type": "application/json" },
    //     });
    //   } catch (error) {
    //     console.error("❌ OAuth callback error:", error);
    //     return new Response(
    //       `Token exchange failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    //       { status: 400 }
    //     );
    //   }
    // }

    // Handle internal booking analysis trigger (for auto-execution)
    if (
      reqUrl.pathname.endsWith("execute-booking-analysis") &&
      request.method === "POST"
    ) {
      try {
        console.log("🎯 Internal booking analysis trigger received");

        // Execute the booking analysis directly
        const result = await this.executeBookingAnalysisInternal();

        return new Response(JSON.stringify({ success: true, result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error in internal booking analysis trigger:", error);
        return new Response(
          JSON.stringify({ success: false, error: (error as Error).message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle listing MCP prompts
    if (reqUrl.pathname.endsWith("list-prompts") && request.method === "GET") {
      try {
        console.log("📋 Listing MCP prompts");
        const prompts = this.mcp.listPrompts();
        console.log("✅ Found prompts:", prompts);
        return new Response(JSON.stringify({ success: true, prompts }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error listing MCP prompts:", error);
        return new Response(
          JSON.stringify({ success: false, error: (error as Error).message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Let the framework handle other requests by calling the parent method
    return (
      super.onRequest?.(request) || new Response("Not found", { status: 404 })
    );
  }

  async executeTask(description: string, _task: any) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
  }
}

// Export agents for Durable Object bindings
export { BookingAnalysisAgent } from "./booking-analysis-agent";

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey,
      });
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
