import { routeAgentRequest, type Schedule } from "agents";

import { unstable_getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  type ToolSet,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls } from "./utils";
import { z } from "zod";

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {

  // Define use_prompt tool as class property
  private usePromptTool = {
    use_prompt: {
      description: "Use an MCP prompt with provided arguments",
      parameters: z.object({
        name: z.string().describe("Prompt name"),
        serverId: z.string().describe("Server ID"),
        arguments: z.record(z.any()).optional().describe("Prompt arguments")
      }),
      execute: async (args: { name: string; serverId: string; arguments?: any }) => {
        try {
          console.log("🚀 Calling getPrompt with:", { 
            name: args.name, 
            serverId: args.serverId, 
            arguments: args.arguments 
          });

          // @ts-ignore
          // This line is a workaround to fix the type error
          // TODO: fix the type error for getPrompt
          const result = await this.mcp.getPrompt({
            name: args.name,
            serverId: args.serverId,
            arguments: args.arguments || {}
          });
          
          console.log("✅ getPrompt result:", result);
          return result;
        } catch (error) {
          console.error("❌ getPrompt error:", error);
          
          // Try to provide more helpful error info
          const errorMsg = (error as Error).message;
          if (errorMsg.includes('Invalid arguments')) {
            return { 
              error: `Prompt "${args.name}" requires specific arguments. Error: ${errorMsg}`,
              suggestion: "The MCP server is expecting different or additional arguments. Check the server documentation for the correct argument structure."
            };
          }
          
          return { error: errorMsg };
        }
      }
    }
  };
  
  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Collect all tools, including MCP tools (cleaned cache)
    const mcpTools = this.mcp.unstable_getAITools();
    console.log("🔧 Available MCP tools:", Object.keys(mcpTools));

    // Filter out problematic tools
    // updateBooking is a problematic tool, so we skip it
    // Need to fix this issue in the future
    const validMcpTools: any = {};
    for (const [toolName, toolDef] of Object.entries(mcpTools)) {
      try {
        // Skip the problematic updateBooking tool
        if (toolName.includes("updateBooking") || toolName.includes("UOojYM9k_updateBooking")) {
          console.warn(`⚠️ Skipping tool with schema issues: ${toolName}`);
          continue;
        }
        
        // Check for invalid array schemas (missing items)
        const toolDefStr = JSON.stringify(toolDef);
        if (toolDefStr.includes('"type":"array"') && !toolDefStr.includes('"items"')) {
          console.warn(`⚠️ Skipping tool with invalid array schema: ${toolName}`);
          continue;
        }

        validMcpTools[toolName] = toolDef;
      } catch (error) {
        console.warn(`⚠️ Skipping invalid tool: ${toolName}`, error);
      }
    }
    console.log("✅ Valid MCP tools:", Object.keys(validMcpTools));

    // Collect all prompts from MCP servers
    const mcpPrompts = this.mcp.listPrompts();
    console.log("📋 Available MCP prompts:", mcpPrompts);

    const allTools = {
      ...validMcpTools,
      ...this.usePromptTool,
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

        console.log("Starting AI stream with OpenAI model");
        console.log("Processed messages count:", processedMessages.length);
        console.log("API key available:", !!process.env.OPENAI_API_KEY);

        // Build prompts context for AI
        let promptsContext = "";
        if (mcpPrompts.length > 0) {
          promptsContext = `\n\nAvailable MCP Prompts:\n${mcpPrompts
            .map((prompt) => {
              let argDetails = "";
              if (prompt.arguments && prompt.arguments.length > 0) {
                const argList = prompt.arguments.map((arg: any) => {
                  const required = arg.required ? " (required)" : " (optional)";
                  const desc = arg.description ? ` - ${arg.description}` : "";
                  return `    • ${arg.name}${required}${desc}`;
                }).join("\n");
                argDetails = `\n  Arguments:\n${argList}`;
              }
              return `- ${prompt.name}: ${prompt.description || "No description"} (Server: ${prompt.serverId || "unknown"})${argDetails}`;
            })
            .join("\n")}\n\nWhen using prompts with the use_prompt tool, you MUST provide all required arguments. For create-consumption-from-image, if no specific arguments are provided, use: {"filename": "image.jpg"} as a default.`;
        }

        // Stream the AI response using OpenAI
        const result = streamText({
          model,
          system: `You are a helpful assistant that can do various tasks... 

          ${unstable_getSchedulePrompt({ date: new Date() })}

          If the user asks to schedule a task, use the schedule tool to schedule the task.${promptsContext}
          `,
          messages: processedMessages,
          tools: allTools,
          experimental_telemetry: {
            isEnabled: true,
          },
          onFinish: async (args: any) => {
            onFinish(
              args as Parameters<StreamTextOnFinishCallback<ToolSet>>[0]
            );
            // await this.mcp.closeConnection(mcpConnection.id);
          },
          onError: (error: any) => {
            console.error("Error while streaming:", error);
          },
          maxSteps: 10,
        });

        // Merge the AI response stream with tool execution outputs
        result.mergeIntoDataStream(dataStream);
      },
    });

    return dataStreamResponse;
  }

  async onRequest(request: Request): Promise<Response> {
    const reqUrl = new URL(request.url);

    // Handle listing MCP servers
    if (reqUrl.pathname.endsWith("list-mcp") && request.method === "GET") {
      try {
        const mcpState = this.getMcpServers();
        const actualServers = mcpState.servers || {};
        console.log("📋 Listing MCP servers:", mcpState);
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
        const mcpServer = (await request.json()) as { url: string; name: string };
        
        const host = reqUrl.origin;
        // const agentPath = "/agents/chat/default/oauth/callback";
        const callbackHost = `${host}`;

        const result = await this.addMcpServer(
          mcpServer.name, 
          mcpServer.url, 
          callbackHost
        );

        return new Response(JSON.stringify({ 
          success: true, 
          result 
        }), { 
          status: 200, 
          headers: { "Content-Type": "application/json" } 
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: (error as Error).message 
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Handle OAuth callback
    if (reqUrl.pathname.endsWith("oauth/callback")) {
      try {
        const code = reqUrl.searchParams.get('code');
        const state = reqUrl.searchParams.get('state');

        if (!code) {
          return new Response("Missing authorization code", { status: 400 });
        }

        // Validate state if needed
        // You might want to check if the state matches a previously generated state

        // Let the MCP manager handle the token exchange
        await this.mcp.handleCallbackRequest(request);

        return new Response(JSON.stringify({ status: 'success' }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('OAuth callback error:', error);
        return new Response(
          `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { status: 400 }
        );
      }
    }

    // Handle listing MCP prompts
    if (reqUrl.pathname.endsWith("list-prompts") && request.method === "GET") {
      try {
        console.log("📋 Listing MCP prompts");
        const prompts = this.mcp.listPrompts();
        console.log("✅ Found prompts:", prompts);
        return new Response(
          JSON.stringify({ success: true, prompts }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
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

  async executeTask(description: string, _task: Schedule<string>) {
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
