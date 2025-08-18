import { routeAgentRequest, getAgentByName } from "agents";
import { AGENT_NAMES, BOOKING_DEFAULTS } from "./constants";
import type { McpToolArgs } from "./types";

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
import { z } from "zod";

const model = openai("gpt-4o-2024-11-20");

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

    // Filter out problematic tools
    // updateBooking is a problematic tool, so we skip it
    // Need to fix this issue in the future
    const validMcpTools: any = {};
    for (const [toolName, toolDef] of Object.entries(mcpTools)) {
      try {
        // Skip the problematic updateBooking tool
        if (
          toolName.includes("updateBooking") ||
          toolName.includes("UOojYM9k_updateBooking")
        ) {
          console.warn(`⚠️ Skipping tool with schema issues: ${toolName}`);
          continue;
        }

        // Check for invalid array schemas (missing items)
        const toolDefStr = JSON.stringify(toolDef);
        if (
          toolDefStr.includes('"type":"array"') &&
          !toolDefStr.includes('"items"')
        ) {
          console.warn(
            `⚠️ Skipping tool with invalid array schema: ${toolName}`
          );
          continue;
        }

        validMcpTools[toolName] = toolDef;
      } catch (error) {
        console.warn(`⚠️ Skipping invalid tool: ${toolName}`, error);
      }
    }
    // Collect all prompts from MCP servers
    const mcpPrompts = this.mcp.listPrompts();

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

      getBookingTemplate: {
        description:
          "Get a complete booking request body template for a customer based on their usual booking patterns. Use this when user asks to create a booking for a specific customer.",
        parameters: z.object({
          customerName: z.string().describe("Customer name or ID to look up"),
          surgeryDate: z
            .string()
            .optional()
            .describe("Surgery date (e.g., 'tomorrow', '2024-01-15')"),
          surgeryTime: z
            .string()
            .optional()
            .describe("Surgery time (e.g., '2pm', '14:00')"),
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
          customerName: string;
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
                surgeryDate: args.surgeryDate,
                surgeryTime: args.surgeryTime,
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
    };

    const allTools = {
      ...validMcpTools,
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
        // Messages processed for tool execution

        // Process image data in messages and convert to multimodal format
        const processedMessagesWithImages = processedMessages.map((message) => {
          // Check if message content contains JSON with image data
          if (typeof message.content === "string") {
            try {
              const parsed = JSON.parse(message.content);
              if (parsed.image && parsed.image.image) {
                // Convert to CoreMessage format with multimodal content
                return {
                  role: "user" as const,
                  content: [
                    {
                      type: "text",
                      text: parsed.text || "Please analyze this image",
                    },
                    {
                      type: "image",
                      image: `data:${parsed.image.mimeType};base64,${parsed.image.image}`,
                    },
                  ],
                };
              }
            } catch (error) {
              // Not JSON, continue with regular processing
            }
          }

          // For non-image messages, convert to CoreMessage format
          return {
            role: message.role as "user" | "system" | "assistant",
            content: message.content,
          };
        });
        // Build prompts context for AI
        let promptsContext = "";
        if (mcpPrompts.length > 0) {
          promptsContext = `\n\nAvailable MCP Prompts:\n${mcpPrompts
            .map((prompt) => {
              let argDetails = "";
              if (prompt.arguments && prompt.arguments.length > 0) {
                const argList = prompt.arguments
                  .map((arg: any) => {
                    const required = arg.required
                      ? " (required)"
                      : " (optional)";
                    const desc = arg.description ? ` - ${arg.description}` : "";
                    return `    • ${arg.name}${required}${desc}`;
                  })
                  .join("\n");
                argDetails = `\n  Arguments:\n${argList}`;
              }
              return `- ${prompt.name}: ${prompt.description || "No description"} (Server: ${prompt.serverId || BOOKING_DEFAULTS.ID})${argDetails}`;
            })
            .join(
              "\n"
            )}\n\nWhen using prompts with the use_prompt tool, you MUST provide all required arguments. Only use MCP prompts when explicitly requested by the user.`;
        }

        // Stream the AI response using OpenAI
        const result = streamText({
          model,
          system: `You are a helpful assistant for MyMediset medical equipment booking system. You can analyze images, manage bookings, and help with various tasks.

          ## Booking Creation Workflow
          When user requests "create booking for [Customer] usuals" or similar:
          1. FIRST: Use getBookingTemplate tool to fetch the customer's booking template with any customizations
          2. Show the getBookingTemplate response.requestBody in a clear, readable format.
          3. Ask if they want to modify anything (times, dates, equipment) before creating the booking
          4. If they confirm or make modifications, use the appropriate MCP createBooking tool with the COMPLETE requestBody from getBookingTemplate response
          5. CRITICAL: Pass the entire requestBody object from getBookingTemplate response directly to createBooking - do not reconstruct or modify the request or miss any fields
          6. NEVER create your own request object - ALWAYS use the complete requestBody from getBookingTemplate
          7. The requestBody from getBookingTemplate includes ALL required fields: customerId, notes, currency, surgeryType, description, isSimulation, collectionDate, reservationType, surgeryDescription
          8. Return the booking creation result to the user

          ## Available Tools
          - getBookingTemplate: Fetches customer's booking template with customizations (date, time, notes)
          - generateBookingTemplates: Creates templates from historical booking analysis
          - executeBookingAnalysis: Analyzes booking data from MCP servers
          - MCP tools: Various tools from connected servers (createBooking, getBooking, etc.)

          ## Example Interactions
          User: "create John's usual booking at 2pm tomorrow"
          → Use getBookingTemplate with customerName="John", surgeryTime="2pm", surgeryDate="tomorrow"
          → Show the generated request body details
          → Ask for confirmation
          → If confirmed, use createBooking MCP tool with the exact requestBody from getBookingTemplate response
          
          CRITICAL EXAMPLE:
          ✅ CORRECT: Use complete requestBody from getBookingTemplate
          const templateResult = await getBookingTemplate({customerName: "John"});
          await createBooking(templateResult.requestBody);  // ← Use entire requestBody object
          
          ❌ WRONG: Never reconstruct the request
          await createBooking({customer: "John", items: [{...}]}); // ← Never do this

          If the user asks to schedule a task, use the schedule tool to schedule the task.${promptsContext}
          
          IMPORTANT: 
          - Only use MCP prompts when the user explicitly asks for them by name or function
          - For booking creation, ALWAYS show the template first before creating
          - Be helpful in explaining booking details and offering modifications
          - For general image analysis or conversation, respond directly using your built-in capabilities`,
          messages: processedMessagesWithImages as CoreMessage[],
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

    // Handle OAuth callback
    if (reqUrl.pathname.endsWith("oauth/callback")) {
      try {
        const code = reqUrl.searchParams.get("code");

        if (!code) {
          return new Response("Missing authorization code", { status: 400 });
        }

        // Validate state if needed
        // You might want to check if the state matches a previously generated state

        // Let the MCP manager handle the token exchange
        await this.mcp.handleCallbackRequest(request);

        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("OAuth callback error:", error);
        return new Response(
          `Token exchange failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          { status: 400 }
        );
      }
    }

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
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
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
