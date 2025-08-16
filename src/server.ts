import { routeAgentRequest, getAgentByName } from "agents";

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
  // Override broadcast to handle WebSocket errors gracefully
  broadcast(message: string, exclude?: string[]) {
    try {
      return super.broadcast(message, exclude);
    } catch (error) {
      console.error("🚨 WebSocket broadcast error (non-fatal):", error);
      // Continue execution - don't let WebSocket errors break the agent
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
      execute: async (args: {
        name: string;
        serverId: string;
        arguments?: any;
      }) => {
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
          console.error("❌ getPrompt error:", error);

          // Try to provide more helpful error info
          const errorMsg = (error as Error).message;
          if (errorMsg.includes("Invalid arguments")) {
            return {
              error: `Prompt "${args.name}" requires specific arguments. Error: ${errorMsg}`,
              suggestion:
                "The MCP server is expecting different or additional arguments. Check the server documentation for the correct argument structure.",
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
    // Collect all tools, including MCP tools
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

    // Counter tools for cross-agent communication
    const counterTools = {
      incrementCounter: {
        description: "Increment the global counter by 1",
        parameters: z.object({}),
        execute: async () => {
          try {
            const counterAgent = await getAgentByName(
              this.env.CounterAgent,
              "main-counter"
            );
            return await counterAgent.increment();
          } catch (error) {
            console.error("Error calling CounterAgent.increment:", error);
            return { error: (error as Error).message };
          }
        },
      },

      getCounterValue: {
        description: "Get the current counter value and last updated time",
        parameters: z.object({}),
        execute: async () => {
          try {
            const counterAgent = await getAgentByName(
              this.env.CounterAgent,
              "main-counter"
            );
            return await counterAgent.getCount();
          } catch (error) {
            console.error("Error calling CounterAgent.getCount:", error);
            return { error: (error as Error).message };
          }
        },
      },

      resetCounter: {
        description: "Reset the counter to 0",
        parameters: z.object({}),
        execute: async () => {
          try {
            const counterAgent = await getAgentByName(
              this.env.CounterAgent,
              "main-counter"
            );
            return await counterAgent.reset();
          } catch (error) {
            console.error("Error calling CounterAgent.reset:", error);
            return { error: (error as Error).message };
          }
        },
      },

      addToCounter: {
        description: "Add a specific value to the counter",
        parameters: z.object({
          value: z.number().describe("The number to add to the counter"),
        }),
        execute: async (args: { value: number }) => {
          try {
            const counterAgent = await getAgentByName(
              this.env.CounterAgent,
              "main-counter"
            );
            return await counterAgent.add(args.value);
          } catch (error) {
            console.error("Error calling CounterAgent.add:", error);
            return { error: (error as Error).message };
          }
        },
      },
    };

    // Booking analysis tools for medical equipment analysis
    const bookingAnalysisTools = {
      getBookingAnalysis: {
        description:
          "Get medical equipment booking analysis including top customers, surgeons, and sales reps with recommendations",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              "main-analyzer"
            );
            return await bookingAgent.getAnalysis();
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.getAnalysis:",
              error
            );
            return { error: (error as Error).message };
          }
        },
      },

      getBookingData: {
        description: "Get all current booking data and statistics",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              "main-analyzer"
            );
            return await bookingAgent.getBookings();
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.getBookings:",
              error
            );
            return { error: (error as Error).message };
          }
        },
      },

      getBookingRecommendations: {
        description:
          "Get AI-generated recommendations based on booking analysis",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              "main-analyzer"
            );
            return await bookingAgent.getRecommendations();
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.getRecommendations:",
              error
            );
            return { error: (error as Error).message };
          }
        },
      },

      refreshBookingAnalysis: {
        description:
          "Trigger a fresh analysis of all booking data from MCP servers",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              "main-analyzer"
            );
            return await bookingAgent.refreshAnalysis();
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.refreshAnalysis:",
              error
            );
            return { error: (error as Error).message };
          }
        },
      },

      resetBookingAnalysisForTesting: {
        description:
          "Reset booking analysis state to allow auto-trigger to run again (for testing purposes)",
        parameters: z.object({}),
        execute: async () => {
          try {
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              "main-analyzer"
            );
            return await bookingAgent.resetForTesting();
          } catch (error) {
            console.error(
              "Error calling BookingAnalysisAgent.resetForTesting:",
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
            // Use Chat agent's MCP connections directly instead of separate agent
            console.log("🚀 Starting booking analysis from Chat agent...");
            
            // Check database and MCP state
            const dbServers = this.sql`SELECT * FROM cf_agents_mcp_servers`;
            console.log("📊 Database:", dbServers.length, "stored servers");

            // Get MCP servers from Chat agent
            const mcpState = this.getMcpServers();
            
            const servers = mcpState.servers || {};
            console.log("🔧 Available MCP servers:", Object.keys(servers));
            
            // Check MCP client manager state
            console.log("🔗 Active connections:", Object.keys(this.mcp.mcpConnections || {}).length);

            // Find a server with booking tools
            let bookingTool = null;
            let targetServerId = null;

            for (const [serverId, serverData] of Object.entries(servers)) {
              console.log(`🔍 Checking server ${serverId}:`, serverData);
              if (
                serverData &&
                typeof serverData === "object" &&
                "state" in serverData &&
                serverData.state === "ready"
              ) {
                try {
                  const serverTools = this.mcp.listTools();
                  console.log(`📋 Server ${serverId} has ${serverTools.length} tools available`);

                  const bookingToolFound = serverTools.find(
                    (tool: any) =>
                      tool.name &&
                      (tool.name.toLowerCase().includes("booking") ||
                        tool.name.toLowerCase().includes("getbooking") ||
                        tool.name === "getBookings")
                  );

                  if (bookingToolFound) {
                    bookingTool = bookingToolFound;
                    targetServerId = serverId;
                    console.log(
                      `✅ Found booking tool "${bookingToolFound.name}" on server ${serverId}`
                    );
                    break;
                  }
                } catch (toolListError) {
                  console.warn(
                    `⚠️ Could not list tools for server ${serverId}:`,
                    toolListError
                  );
                }
              }
            }

            if (!bookingTool || !targetServerId) {
              console.warn(
                "⚠️ No booking tool found on any connected MCP server"
              );
              return {
                success: false,
                message: "No MCP booking tool available",
              };
            }

            console.log("🔄 Executing booking tool...");
            console.log(
              `📡 Calling tool: ${bookingTool.name} on server: ${targetServerId}`
            );

            // Use Chat agent's MCP client to call the tool
            const mcpResult = await this.mcp.callTool({
              serverId: targetServerId,
              name: bookingTool.name,
              arguments: {},
            });

            console.log("📊 MCP booking result received successfully (", typeof mcpResult === 'object' && mcpResult ? Object.keys(mcpResult).join(', ') : 'data', ")");

            // Process the result and send to BookingAnalysisAgent for analysis
            const bookingAgent = await getAgentByName(
              this.env.BookingAnalysisAgent,
              "main-analyzer"
            );

            // Extract booking data from MCP result
            let bookingData: any[] = [];
            
            if (mcpResult && typeof mcpResult === "object") {
              // Handle direct array
              if (Array.isArray(mcpResult)) {
                bookingData = mcpResult;
              } 
              // Handle MCP content structure: { content: [{ type: "text", text: "..." }] }
              else if ((mcpResult as any).content && Array.isArray((mcpResult as any).content)) {
                const content = (mcpResult as any).content;
                for (const item of content) {
                  if (item.type === "text" && item.text) {
                    try {
                      const parsed = JSON.parse(item.text);
                      if (parsed.bookings && Array.isArray(parsed.bookings)) {
                        bookingData = parsed.bookings;
                        break;
                      } else if (parsed.data && Array.isArray(parsed.data)) {
                        bookingData = parsed.data;
                        break;
                      } else if (Array.isArray(parsed)) {
                        bookingData = parsed;
                        break;
                      }
                    } catch (parseError) {
                      console.warn("⚠️ Failed to parse booking content:", parseError);
                    }
                  }
                }
              }
              // Handle direct .data property
              else if (
                (mcpResult as any).data &&
                Array.isArray((mcpResult as any).data)
              ) {
                bookingData = (mcpResult as any).data;
              } 
              // Handle direct .bookings property
              else if (
                (mcpResult as any).bookings &&
                Array.isArray((mcpResult as any).bookings)
              ) {
                bookingData = (mcpResult as any).bookings;
              }
            }
            
            console.log("📊 Extracted", bookingData.length, "bookings from MCP");

            if (bookingData.length > 0) {
              // Send the booking data to BookingAnalysisAgent for processing
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
      ...counterTools,
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
              return `- ${prompt.name}: ${prompt.description || "No description"} (Server: ${prompt.serverId || "unknown"})${argDetails}`;
            })
            .join(
              "\n"
            )}\n\nWhen using prompts with the use_prompt tool, you MUST provide all required arguments. Only use MCP prompts when explicitly requested by the user.`;
        }

        // Stream the AI response using OpenAI
        const result = streamText({
          model,
          system: `You are a helpful assistant that can analyze images and do various tasks.

          

          If the user asks to schedule a task, use the schedule tool to schedule the task.${promptsContext}
          
          IMPORTANT: Only use MCP prompts when the user explicitly asks for them by name or function. For general image analysis or conversation, respond directly using your built-in capabilities without automatically invoking MCP tools.`,
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
            // await this.mcp.closeConnection(mcpConnection.id);
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

  // Internal method to execute booking analysis (for auto-triggering)
  private async executeBookingAnalysisInternal() {
    try {
      console.log("🚀 Starting internal booking analysis execution...");
      
      // Check database and MCP state
      const dbServers = this.sql`SELECT * FROM cf_agents_mcp_servers`;
      console.log("📊 Database:", dbServers.length, "stored servers");

      // Get MCP servers from Chat agent
      const mcpState = this.getMcpServers();
      
      const servers = mcpState.servers || {};
      console.log("🔧 Available MCP servers:", Object.keys(servers));
      
      // Check MCP client manager state
      console.log("🔗 Active connections:", Object.keys(this.mcp.mcpConnections || {}).length);

      // Find a server with booking tools
      let bookingTool = null;
      let targetServerId = null;

      for (const [serverId, serverData] of Object.entries(servers)) {
        console.log(`🔍 Checking server ${serverId}:`, serverData);
        if (
          serverData &&
          typeof serverData === "object" &&
          "state" in serverData &&
          serverData.state === "ready"
        ) {
          try {
            const serverTools = this.mcp.listTools();
            console.log(`📋 Server ${serverId} has ${serverTools.length} tools available`);

            const bookingToolFound = serverTools.find(
              (tool: any) =>
                tool.name &&
                (tool.name.toLowerCase().includes("booking") ||
                  tool.name.toLowerCase().includes("getbooking") ||
                  tool.name === "getBookings")
            );

            if (bookingToolFound) {
              bookingTool = bookingToolFound;
              targetServerId = serverId;
              console.log(
                `✅ Found booking tool "${bookingToolFound.name}" on server ${serverId}`
              );
              break;
            }
          } catch (toolListError) {
            console.warn(
              `⚠️ Could not list tools for server ${serverId}:`,
              toolListError
            );
          }
        }
      }

      if (!bookingTool || !targetServerId) {
        console.warn(
          "⚠️ No booking tool found on any connected MCP server"
        );
        return {
          success: false,
          message: "No MCP booking tool available",
        };
      }

      console.log("🔄 Executing booking tool...");
      console.log(
        `📡 Calling tool: ${bookingTool.name} on server: ${targetServerId}`
      );

      // Use Chat agent's MCP client to call the tool
      const mcpResult = await this.mcp.callTool({
        serverId: targetServerId,
        name: bookingTool.name,
        arguments: {},
      });

      console.log("📊 MCP booking result received successfully (", typeof mcpResult === 'object' && mcpResult ? Object.keys(mcpResult).join(', ') : 'data', ")");

      // Process the result and send to BookingAnalysisAgent for analysis
      const bookingAgent = await getAgentByName(
        this.env.BookingAnalysisAgent,
        "main-analyzer"
      );

      // Extract booking data from MCP result
      let bookingData: any[] = [];
      
      if (mcpResult && typeof mcpResult === "object") {
        // Handle direct array
        if (Array.isArray(mcpResult)) {
          bookingData = mcpResult;
        } 
        // Handle MCP content structure: { content: [{ type: "text", text: "..." }] }
        else if ((mcpResult as any).content && Array.isArray((mcpResult as any).content)) {
          const content = (mcpResult as any).content;
          for (const item of content) {
            if (item.type === "text" && item.text) {
              try {
                const parsed = JSON.parse(item.text);
                if (parsed.bookings && Array.isArray(parsed.bookings)) {
                  bookingData = parsed.bookings;
                  break;
                } else if (parsed.data && Array.isArray(parsed.data)) {
                  bookingData = parsed.data;
                  break;
                } else if (Array.isArray(parsed)) {
                  bookingData = parsed;
                  break;
                }
              } catch (parseError) {
                console.warn("⚠️ Failed to parse booking content:", parseError);
              }
            }
          }
        }
        // Handle direct .data property
        else if (
          (mcpResult as any).data &&
          Array.isArray((mcpResult as any).data)
        ) {
          bookingData = (mcpResult as any).data;
        } 
        // Handle direct .bookings property
        else if (
          (mcpResult as any).bookings &&
          Array.isArray((mcpResult as any).bookings)
        ) {
          bookingData = (mcpResult as any).bookings;
        }
      }
      
      console.log("📊 Extracted", bookingData.length, "bookings from MCP");

      if (bookingData.length > 0) {
        // Send the booking data to BookingAnalysisAgent for processing
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
        // Check database and MCP state
        const dbServers = this.sql`SELECT * FROM cf_agents_mcp_servers`;
        console.log("📊 Database has", dbServers.length, "stored servers");
        
        // Get MCP servers
        const mcpState = this.getMcpServers();
        const actualServers = mcpState.servers || {};
        console.log("📋 Available server IDs:", Object.keys(actualServers));
        
        return new Response(
          JSON.stringify({ success: true, servers: actualServers }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("❌ Error listing MCP servers:", error);
        return new Response(
          JSON.stringify({ success: false, error: (error as Error).message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle disconnecting ALL MCP servers + clean everything
    if (
      reqUrl.pathname.endsWith("disconnect-all-mcp") &&
      request.method === "POST"
    ) {
      try {
        console.log("🔌 Disconnecting ALL MCP servers and cleaning everything");

        // Get list of all servers before disconnecting
        const mcpState = this.getMcpServers();
        const actualServers = mcpState.servers || {};
        console.log("📋 Servers to remove:", Object.keys(actualServers));

        // Disconnect all connections
        await this.mcp.closeAllConnections();

        // Remove each server from database
        for (const [serverId, serverData] of Object.entries(actualServers)) {
          try {
            console.log(
              "🗑️ Removing server from database:",
              serverId,
              serverData
            );
            await this.removeMcpServer(serverId);
          } catch (removeError) {
            console.warn(
              "⚠️ Error removing server from database:",
              serverId,
              removeError
            );
          }
        }

        // Also try to clear the entire MCP servers table as a fallback
        try {
          console.log("🧹 Clearing entire MCP servers table");
          // Access the SQLite database using the Agent framework method
          this.sql`DELETE FROM cf_agents_mcp_servers`;
          console.log("✅ MCP servers table cleared (fallback)");
        } catch (dbError) {
          console.warn("⚠️ Error clearing MCP servers table:", dbError);
        }

        // Force clear the cached tools by reinitializing the entire MCP manager
        console.log("🧹 Reinitializing MCP manager to clear all caches");
        const { MCPClientManager } = await import("agents/mcp/client");
        this.mcp = new MCPClientManager(this.constructor.name, "0.0.1");

        console.log(
          "✅ All MCP servers disconnected, removed from database, and MCP manager reinitialized"
        );

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error disconnecting all MCP servers:", error);
        return new Response(
          JSON.stringify({ success: false, error: (error as Error).message }),
          {
            status: 500,
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
        const state = reqUrl.searchParams.get("state");

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
    if (reqUrl.pathname.endsWith("execute-booking-analysis") && request.method === "POST") {
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

    // Handle manual database cleanup for MCP servers
    if (
      reqUrl.pathname.endsWith("force-clear-mcp-db") &&
      request.method === "POST"
    ) {
      try {
        console.log("🧹 Force clearing MCP servers database");

        // Access the SQLite database using the Agent framework method
        try {
          // Clear the table
          this.sql`DELETE FROM cf_agents_mcp_servers`;
          console.log("🗑️ MCP servers table cleared");

          // Verify the table is empty
          const remainingServers = this
            .sql`SELECT COUNT(*) as count FROM cf_agents_mcp_servers`;
          const remainingCount =
            remainingServers.length > 0 ? remainingServers[0].count : 0;
          console.log("📊 Remaining servers in DB:", remainingCount);

          // Also disconnect all active connections
          await this.mcp.closeAllConnections();
          console.log("🔌 All active connections closed");

          // Reinitialize MCP manager
          const { MCPClientManager } = await import("agents/mcp/client");
          this.mcp = new MCPClientManager(this.constructor.name, "0.0.1");
          console.log("🔄 MCP manager reinitialized");

          return new Response(
            JSON.stringify({
              success: true,
              message: "Database force cleared",
              remainingCount: remainingCount || 0,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (dbError) {
          console.error("❌ Error with database operations:", dbError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Database error: ${(dbError as Error).message}`,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch (error) {
        console.error("❌ Error force clearing MCP database:", error);
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
export { CounterAgent } from "./counter-agent";
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
