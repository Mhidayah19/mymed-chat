import { useState, useEffect } from "react";
import {
  Plus,
  Trash,
  Network,
  Play,
  Stop,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";
import { useMcp } from "use-mcp/react";
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
  onToolsUpdate?: (tools: unknown[]) => void;
}

const MCPSettings = ({ onToolsUpdate }: MCPSettingsProps) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  // MCP connection for the currently active server
  const activeServer = servers.find((s) => s.id === activeServerId);
  const { state, tools, error, disconnect } = useMcp({
    url: activeServer?.actualUrl || "",
    clientName: "MCP Settings",
    debug: true,
    preventAutoAuth: true,
    transportType:
      (activeServer?.transport.toLowerCase() as "sse" | "http") || "auto",
  });

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
  };

  // Update server connection status
  useEffect(() => {
    if (activeServerId && activeServer) {
      const connected = state === "ready";
      setServers((prev) =>
        prev.map((server) =>
          server.id === activeServerId ? { ...server, connected } : server
        )
      );
    }
  }, [state, activeServerId, activeServer]);

  // Notify parent component when tools change
  useEffect(() => {
    if (onToolsUpdate && tools) {
      const mcpTools = tools.map((tool) => ({
        ...tool,
        source: "mcp",
        serverId: activeServerId,
        serverName: activeServer?.name || "Unknown",
      }));
      onToolsUpdate(mcpTools);
    } else if (onToolsUpdate) {
      onToolsUpdate([]);
    }
  }, [tools, onToolsUpdate, activeServerId, activeServer]);

  const handleAddServer = () => {
    setIsModalOpen(true);
  };

  const handleAddNewServer = (newServer: Server) => {
    setServers([...servers, newServer]);
  };

  const handleDeleteServer = (serverId: string) => {
    if (serverId === activeServerId) {
      disconnect();
      setActiveServerId(null);
    }
    setServers(servers.filter((server) => server.id !== serverId));
  };

  const handleConnectServer = (serverId: string) => {
    if (activeServerId && activeServerId !== serverId) {
      disconnect();
    }
    setActiveServerId(serverId);
  };

  const handleDisconnectServer = () => {
    disconnect();
    setActiveServerId(null);
  };

  return (
    <>
      <AddServerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddServer={handleAddNewServer}
      />
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={handleToggle}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  isEnabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              {isEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

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
          <button
            onClick={handleAddServer}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Server
          </button>
        </div>

        {/* Server List */}
        <div className="space-y-3">
          {servers.map((server) => {
            const isActive = server.id === activeServerId;
            const isConnected = server.connected;
            const isConnecting = isActive && state === "connecting";

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
                  ) : isConnecting ? (
                    <Network className="w-5 h-5 text-yellow-500 animate-pulse" />
                  ) : error && isActive ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Network className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {server.name}
                    </div>
                    {isConnected && tools && tools.length > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        {tools.length} tools
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
                    {server.url}
                  </div>
                  {error && isActive && (
                    <div className="text-xs text-red-500 mt-1">{error}</div>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  {!isActive ? (
                    <button
                      onClick={() => handleConnectServer(server.id)}
                      className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                      title="Connect to server"
                      disabled={!isEnabled}
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleDisconnectServer}
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
      </div>
    </>
  );
};

export default MCPSettings;
