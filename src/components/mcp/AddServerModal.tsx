import type React from "react";
import { useState } from "react";
import { Network, X, Globe } from "@phosphor-icons/react";

interface Server {
  id: string;
  name: string;
  url: string;
  transport: "SSE" | "HTTP";
  actualUrl: string;
  connected?: boolean;
}

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddServer: (server: Server) => void;
}

const AddServerModal = ({
  isOpen,
  onClose,
  onAddServer,
}: AddServerModalProps) => {
  const [serverName, setServerName] = useState("My MCP Server");
  const [transportType, setTransportType] = useState("SSE");
  const [serverUrl, setServerUrl] = useState(
    "https://mcp.example.com/token/sse"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newServer = {
      id: Date.now().toString(),
      name: serverName,
      url: `${transportType} • ${serverUrl}`,
      transport: transportType as "SSE" | "HTTP",
      actualUrl: serverUrl,
      connected: false,
    };
    onAddServer(newServer);
    onClose();
    // Reset form
    setServerName("My MCP Server");
    setTransportType("SSE");
    setServerUrl("https://mcp.example.com/token/sse");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Add New MCP Server
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Server Name */}
          <div>
            <label
              htmlFor="serverName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Server Name
            </label>
            <input
              type="text"
              id="serverName"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Transport Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Transport Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransportType("SSE")}
                className={`flex items-center gap-3 p-3 border rounded-md text-left transition-colors ${
                  transportType === "SSE"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Network className="w-5 h-5" />
                <div>
                  <div className="font-medium">SSE</div>
                  <div className="text-xs text-gray-500">
                    Server-Sent Events
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTransportType("HTTP")}
                className={`flex items-center gap-3 p-3 border rounded-md text-left transition-colors ${
                  transportType === "HTTP"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Globe className="w-5 h-5" />
                <div>
                  <div className="font-medium">HTTP</div>
                  <div className="text-xs text-gray-500">HTTP Streamable</div>
                </div>
              </button>
            </div>
          </div>

          {/* Server URL */}
          <div>
            <label
              htmlFor="serverUrl"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Server URL
            </label>
            <input
              type="url"
              id="serverUrl"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://mcp.example.com/token/sse"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Full URL to the MCP server endpoint
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Add Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddServerModal;
