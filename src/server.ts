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

// Create OpenAI model with explicit API key
const model = openai("gpt-4o-2024-11-20");

// Debug: Check if API key is loaded
console.log(
  "OpenAI API Key loaded:",
  !!process.env.OPENAI_API_KEY
);

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
    const rawMcpTools = this.mcp.unstable_getAITools();

    // Create filtered MCP tools that remove problematic fields for booking operations
    // const mcpTools = this.createFilteredMcpTools(rawMcpTools);

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
          "Get a complete booking request body template for a customer based on their usual booking patterns, or find templates by surgeon. Use this when user asks to create a booking for a specific customer or surgeon. IMPORTANT: This tool renders a RecommendedBookingCard UI component - do not generate any additional text after calling this tool.",
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
            const result = await (bookingAgent as any).generateBookingRequest(
              args.customerName,
              {
                surgeon: args.surgeon,
                surgeryDate: args.surgeryDate,
                notes: args.notes,
                isDraft: args.isDraft,
              }
            );

            // Return structured data for RecommendedBookingCard component
            return {
              type: "recommended-booking",
              ...result,
              // Special marker to indicate this is a complete UI response
              _complete_ui_response: true,
            };
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
          "Get the cached booking templates that were previously generated. IMPORTANT: This tool renders a CachedTemplatesCard UI component - do not generate any additional text after calling this tool.",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              AGENT_NAMES.MAIN_ANALYZER
            );
            const templates = await (bookingAgent as any).getCachedTemplates();

            // Return structured data for CachedTemplatesCard component
            return {
              type: "cached-templates",
              ...templates,
              // Special marker to indicate this is a complete UI response
              _complete_ui_response: true,
            };
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
      ...rawMcpTools,
      ...this.usePromptTool,
      ...bookingAnalysisTools,
    };

    // Debug: Log all tool names to identify Gemini naming issues
    console.log("=== TOOL NAMES DEBUG ===");
    Object.keys(allTools).forEach((toolName, index) => {
      const isValid = /^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/.test(toolName);
      console.log(`${index + 1}. "${toolName}" - ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    });
    console.log("========================");

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

        // Stream the AI response using OpenAI
        console.log("Starting streamText with OpenAI model");
        const result = streamText({
          model,
          system: `You are a helpful assistant for MyMediset medical equipment booking system. You can manage bookings, and help with various tasks.
           Keep your responses concise and to the point.
          
          CRITICAL INSTRUCTION: For UI Tool Operations (getCachedTemplates, getRecommendedBooking, createBooking):
          - ABSOLUTE REQUIREMENT: Generate ZERO additional text
          - The UI component IS the ENTIRE response
          - NO text explanation, description, or commentary is allowed
          - ONLY the tool result with _complete_ui_response: true is permitted
          - ANY additional text WILL BE IMMEDIATELY DISCARDED
          
          STRICT WORKFLOW FOR UI TOOLS:
          1. When tool is called, ONLY return the tool result
          2. DO NOT add any human-readable text
          3. The UI component handles ALL presentation and explanation
          4. Your SOLE task is to return the raw tool result
          
          ## Current Context
          Today's Date: ${new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          
          ## Booking Creation Workflow
          When user requests "create booking for [Customer] usuals" or similar:
          1. FIRST: Use getRecommendedBooking tool to fetch the customer's booking template with any customizations - this will display the template automatically
          2. If user did not specify any customer or surgeon, OR if getRecommendedBooking returns no templates/empty results, use the getCachedTemplates tool to fetch all available cached templates.
          3. If getRecommendedBooking shows "No Templates Found" or empty results,do not render any UI, immediately follow up with getCachedTemplates to show alternative options
          4. After getRecommendedBooking displays a valid template, ask if they want to modify anything (times, dates, equipment) before creating the booking
          5. If user specify the date of surgery like tomorrow,next week,next month or next year. Do interpret the date and set the date in the requestBody.
          6. If they confirm or make modifications, use the appropriate MCP createBooking tool with the COMPLETE requestBody from getRecommendedBooking response
          7. CRITICAL: Pass the EXACT requestBody object from getRecommendedBooking response directly to createBooking - do not add, remove, or modify ANY fields  
          8. NEVER create your own request object - ALWAYS use the complete requestBody from getRecommendedBooking AS-IS
          9. DO NOT add any additional fields like poNumber, telephone, bookingStatus, releaseDate, estimatedValue - use ONLY what's in the requestBody
          10. The requestBody from getRecommendedBooking includes ALL required fields: customerId,customerName, notes, currency, surgeryType, description, isSimulation, collectionDate, reservationType, surgeryDescription
          11. Do not forget to include customerName in the requestBody.
          12. Proceed with simulation true and return the booking creation result to the user, do include status of isAvaliable 
          13. Inform customer about isAvailable and would like to proceed with booking simulation false?
          14. IMPORTANT: After booking operations (create/update), the BookingOperationResultCard component will display automatically

          ## UI Tool Operations (getCachedTemplates, getRecommendedBooking, createBooking)
          These tools automatically render specialized UI components:
          1. getCachedTemplates: Renders CachedTemplatesCard for multiple templates grid view
          2. getRecommendedBooking: Renders RecommendedBookingCard for single booking recommendation  
          3. createBooking/updateBooking: Renders BookingOperationResultCard for booking operation results (will use template data from conversation context for customer/sales rep names)
          4. After calling these tools, do NOT generate any additional text - the UI components are the complete response
          5. The components automatically handle all data parsing and display
          
          ### For All Other Tool Operations
          For other tool execution (analytics, etc.), use this format:
          \`\`\`tool-result
          tool: [tool name]
          status: success|error|info
          title: [descriptive title]
          [key]: [value]
          [key]: [value]
          \`\`\`
          
          Example (for analytics tools only):
          
          
          tool: getRecommendedBooking
          status: success
          title: Booking Recommendation Generated
          customer: HOSPITAL NAME
          surgeon: Dr Stephen Hawkins
          equipment: Cranial Kit
          itemCount: 5
          

          ## Available Tools
          - getRecommendedBooking: Fetches customer's booking template with customizations (date, time, notes) - displays RecommendedBookingCard component
          - getCachedTemplates: Shows all cached booking templates - displays CachedTemplatesCard component
          - generateBookingTemplates: Creates templates from historical booking analysis
          - executeBookingAnalysis: Analyzes booking data from MCP servers
          - MCP tools: Various tools from connected servers (createBooking displays BookingOperationResultCard, getBooking, etc.)

          ## Example Interactions
          User: "create John's usual booking at tomorrow"
          → Use getRecommendedBooking with customerName="John", surgeryDate="tomorrow" (displays template automatically)
          → Ask for confirmation based on displayed template
          → If confirmed, use createBooking MCP tool with the exact requestBody from getRecommendedBooking response
          
          User: "create usuals for Dr Stephen"
          → Use getRecommendedBooking with surgeon="Dr Stephen" (displays template or "No Templates Found")
          → If "No Templates Found" or empty results, immediately use getCachedTemplates to show available alternatives
          → Let user select from available templates
          
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
          - CRITICAL: When using getCachedTemplates (CachedTemplatesCard), getRecommendedBooking (RecommendedBookingCard), or createBooking (BookingOperationResultCard), ONLY call the tool and provide NO additional text. The tool result IS the complete response.
          - For analytics and other non-UI tools, use the tool-result markdown format
          - CRITICAL: Never generate text after getCachedTemplates, getRecommendedBooking, or createBooking - the UI components handle everything automatically`,
          messages: processedMessages,
          tools: Object.fromEntries(
            Object.entries(allTools).map(([name, tool]) => {
              const sanitizedName = name.replace(/^[^a-zA-Z_]/, '_').replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 64);
              
              // Create a wrapper that preserves original tool execution
              return [sanitizedName, {
                ...tool,
                execute: async (args: any) => {
                  // Use type assertion to bypass type checking
                  if ((allTools as Record<string, any>)[name] && (allTools as Record<string, any>)[name].execute) {
                    return await (allTools as Record<string, any>)[name].execute(args);
                  }
                  return tool.execute ? await tool.execute(args) : {};
                }
              }];
            })
          ),
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
