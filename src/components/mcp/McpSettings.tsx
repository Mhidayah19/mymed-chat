import { useState, useEffect } from "react";
import {
  Plus,
  Trash,
  Network,
  Play,
  Stop,
  CheckCircle,
} from "@phosphor-icons/react";
import { agentFetch } from "agents/client";
import AddServerModal from "./AddServerModal";

interface Server {
  id: string;
  name: string;
  url: string;
  transport: "SSE" | "HTTP";
  actualUrl: string;
  connected?: boolean;
}

interface MCPSettingsProps {
  agent: any;
}

const MCPSettings = ({ agent }: MCPSettingsProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<any[]>([]);

  // MCP connection is now handled by the backend agent
  // const activeServer = servers.find((s) => s.id === activeServerId);

  // Load connected servers from backend on mount
  useEffect(() => {
    const loadConnectedServers = async () => {
      try {
        // Use HTTP fetch for listing servers
        const response = await agentFetch({
          agent: "chat",
          host: agent.host,
          name: "default",
          path: "list-mcp",
        });

        if (response.ok) {
          const result = (await response.json()) as {
            success?: boolean;
            servers?: Record<string, any>;
            error?: string;
          };
          console.log("📋 MCP servers response:", result);

          if (result.success !== false && result.servers) {
            // Convert backend servers to frontend format
            const backendServers = Object.entries(result.servers || {}).map(
              ([id, server]: [string, any]) => ({
                id,
                name: server.name || "Unknown Server",
                url: `${server.transport || "SSE"} • ${server.server_url}`,
                transport: (server.transport || "SSE") as "SSE" | "HTTP",
                actualUrl: server.server_url,
                connected: server.state === "ready",
              })
            );

            setServers(backendServers);
          } else {
            console.warn("⚠️ Server returned error:", result.error);
            setServers([]); // Clear servers on error
          }
        } else {
          console.error(
            "❌ Response not ok:",
            response.status,
            response.statusText
          );
          setServers([]); // Clear servers on error
        }
      } catch (error) {
        console.error("❌ Error loading connected servers:", error);
      }
    };

    loadConnectedServers();
    loadPrompts();
  }, [agent]);

  // Load prompts from backend
  const loadPrompts = async () => {
    try {
      const response = await agentFetch({
        agent: "chat",
        host: agent.host,
        name: "default",
        path: "list-prompts",
      });

      if (response.ok) {
        const result = (await response.json()) as {
          success: boolean;
          prompts: any[];
        };
        console.log("📋 Available MCP prompts:", result.prompts);
        setPrompts(result.prompts || []);
      }
    } catch (error) {
      console.error("❌ Error loading prompts:", error);
    }
  };

  const handleAddServer = () => {
    setIsModalOpen(true);
  };

  const handleAddNewServer = (newServer: Server) => {
    // Just add to local state - connection happens when play button is pressed
    const serverWithStatus = {
      ...newServer,
      connected: false, // Not connected until play button is pressed
    };
    setServers([...servers, serverWithStatus]);
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      console.log("🗑️ Removing MCP server completely:", serverId);

      // Use HTTP fetch for removing servers
      const response = await agentFetch(
        {
          agent: "chat",
          host: agent.host,
          name: "default",
          path: "remove-mcp",
        },
        {
          method: "POST",
          body: JSON.stringify({ serverId }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        console.log("✅ MCP server removed completely via HTTP");
        // Remove from local state
        setServers(servers.filter((server) => server.id !== serverId));
        if (serverId === activeServerId) {
          setActiveServerId(null);
        }
      } else {
        const error = (await response.json()) as { error?: string };
        console.error("❌ Failed to remove MCP server:", error);
        // Still remove from local state even if backend removal failed
        setServers(servers.filter((server) => server.id !== serverId));
        if (serverId === activeServerId) {
          setActiveServerId(null);
        }
      }
    } catch (error) {
      console.error("❌ Error removing MCP server:", error);
      // Still remove from local state even if request failed
      setServers(servers.filter((server) => server.id !== serverId));
      if (serverId === activeServerId) {
        setActiveServerId(null);
      }
    }
  };

  const handleConnectServer = async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    // Initiate backend connection
    try {
      console.log("Connecting to MCP server via backend...");

      // Use HTTP fetch (reliable and proven)
      const response = await agentFetch(
        {
          agent: "chat",
          host: agent.host,
          name: "default",
          path: "add-mcp",
        },
        {
          method: "POST",
          body: JSON.stringify({ name: server.name, url: server.actualUrl }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const result = (await response.json()) as {
          success: boolean;
          result?: { authUrl?: string };
        };
        console.log("✅ MCP server connected via backend:", result);
        console.log(
          "🔍 FRONTEND - Checking for authUrl in result.result:",
          result.result?.authUrl
        );
        console.log(
          "🔍 FRONTEND - Checking for authUrl directly in result:",
          (result as any).authUrl
        );
        console.log("🔍 Full result object:", JSON.stringify(result, null, 2));

        // Fix: The authUrl is directly in result, not in result.result
        const authUrl = (result as any).authUrl || result.result?.authUrl;

        // If OAuth is required, open auth window
        if (authUrl) {
          console.log("🔐 OAuth required, opening auth window...");
          console.log("🔐 Auth URL:", authUrl);
          window.open(
            authUrl,
            "mcpAuth",
            "width=600,height=800,resizable=yes,scrollbars=yes,toolbar=yes,menubar=no,location=no,directories=no,status=yes"
          );
        } else {
          console.log("ℹ️ No OAuth required - direct connection");
          console.log("ℹ️ result.result:", result.result);
          console.log("ℹ️ typeof result.result:", typeof result.result);
        }

        // Update server status
        setServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? { ...s, connected: !authUrl } // Connected if no auth required
              : s
          )
        );
        setActiveServerId(serverId);
      } else {
        const error = (await response.json()) as { error?: string };
        console.error("❌ Backend failed to connect MCP server:", error);
      }
    } catch (error) {
      console.error("❌ Error connecting to backend:", error);
    }
  };

  const handleDisconnectServer = async (serverId: string) => {
    try {
      const response = await agentFetch(
        {
          agent: "chat",
          host: agent.host,
          name: "default",
          path: "disconnect-mcp",
        },
        {
          method: "POST",
          body: JSON.stringify({ serverId }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, connected: false } : s))
        );
        if (serverId === activeServerId) {
          setActiveServerId(null);
        }
      }
    } catch (error) {
      console.error("❌ Error disconnecting server:", error);
    }
  };

  return (
    <>
      <AddServerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddServer={handleAddNewServer}
      />
      <div className="w-full">
        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Connect to Model Context Protocol servers to access additional AI
          tools.
        </p>

        {/* Add Server Button */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {servers.length} server{servers.length !== 1 ? "s" : ""} configured
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleAddServer}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
          </div>
        </div>

        {/* Server List */}
        <div className="space-y-3">
          {servers.map((server) => {
            const isActive = server.id === activeServerId;
            const isConnected = server.connected;
            // const isConnecting = false; // Backend handles connection status

            return (
              <div
                key={server.id}
                className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : "bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-600"
                }`}
              >
                <div className="flex-shrink-0">
                  {isConnected ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Network className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {server.name}
                    </div>
                    {isConnected && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        Connected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
                    {server.url}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  {!isConnected ? (
                    <button
                      onClick={() => handleConnectServer(server.id)}
                      className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                      title="Connect to server"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDisconnectServer(server.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Disconnect from server"
                    >
                      <Stop className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteServer(server.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete server"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {servers.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Network className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No servers configured</p>
            <p className="text-xs text-gray-400">Add a server to get started</p>
          </div>
        )}

        {/* Prompts Section */}
        {prompts.length > 0 && (
          <div className="mt-8 border-t border-gray-200 dark:border-neutral-600 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Available Prompts ({prompts.length})
            </h3>
            <div className="space-y-2">
              {prompts.map((prompt, index) => (
                <div
                  key={`${prompt.name}-${prompt.serverId || index}`}
                  className="p-3 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-md"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {prompt.name}
                    </div>
                    {prompt.description && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {prompt.description}
                      </div>
                    )}
                    {prompt.serverId && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Server: {prompt.serverId}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MCPSettings;
