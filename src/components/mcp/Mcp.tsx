import { useMcp } from "use-mcp/react";
import { useState, useEffect } from "react";

export function Mcp({
  onToolsUpdate,
}: {
  onToolsUpdate?: (tools: unknown[]) => void;
}) {
  const [serverUrl, setServerUrl] = useState(() => {
    return (
      sessionStorage.getItem("mcpServerUrl") ||
      "https://mymediset-xba-dev-eu10.mymediset-mcp.com/sse"
    );
  });
  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [transportType, setTransportType] = useState<"auto" | "http" | "sse">(
    () => {
      return (
        (sessionStorage.getItem("mcpTransportType") as
          | "auto"
          | "http"
          | "sse") || "auto"
      );
    }
  );
  const [showAuth, setShowAuth] = useState(false);
  const [headerKey, setHeaderKey] = useState(() => {
    return sessionStorage.getItem("mcpHeaderKey") || "Authorization";
  });
  const [bearerToken, setBearerToken] = useState(() => {
    return sessionStorage.getItem("mcpBearerToken") || "";
  });
  const [showToken, setShowToken] = useState(false);

  // Alternative test servers (uncomment to test):
  // const [serverUrl, setServerUrl] = useState('https://api.github.com')
  // const [serverUrl, setServerUrl] = useState('https://httpbin.org/json')

  const {
    state,
    tools,
    callTool,
    error,
    log,
    authenticate,
    retry,
    disconnect,
  } = useMcp({
    url: serverUrl,
    clientName: "Test App",
    debug: true,
    preventAutoAuth: false, // Allow automatic auth popup
    callbackUrl: `${window.location.origin}/oauth/callback`,
    transportType,
    customHeaders:
      headerKey && bearerToken ? { [headerKey]: `Bearer ${bearerToken}` } : {},
  });

  const handleConnect = () => {
    setServerUrl(inputUrl);
    sessionStorage.setItem("mcpServerUrl", inputUrl);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Notify parent component when tools change
  useEffect(() => {
    if (onToolsUpdate && tools && tools.length > 0) {
      onToolsUpdate(
        tools.map((t) => ({
          ...t,
          callTool: (args?: Record<string, unknown>) => callTool(t.name, args),
        }))
      );
    }
  }, [tools, onToolsUpdate, callTool]);

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-neutral-800 max-w-md shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔗</span>
          <h3 className="font-bold text-sm">MCP Connection Manager</h3>
        </div>
        {onToolsUpdate && (
          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
            🔄 Integrated
          </span>
        )}
      </div>

      <div className="mb-2">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => {
            setInputUrl(e.target.value);
            sessionStorage.setItem("mcpServerUrl", e.target.value);
          }}
          className="w-full p-1 text-xs border rounded mb-2"
          placeholder="MCP Server URL"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium">Transport:</label>
          <select
            value={transportType}
            onChange={(e) => {
              const newTransport = e.target.value as "auto" | "http" | "sse";
              setTransportType(newTransport);
              sessionStorage.setItem("mcpTransportType", newTransport);
            }}
            className="text-xs border rounded px-1 py-0.5"
          >
            <option value="auto">Auto</option>
            <option value="http">HTTP</option>
            <option value="sse">SSE</option>
          </select>
        </div>
      </div>

      {/* Authentication Section */}
      <div className="mb-2 border border-gray-200 rounded-md bg-gray-50">
        <button
          type="button"
          className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-100 rounded-md transition-colors"
          onClick={() => setShowAuth(!showAuth)}
        >
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-700">
              🔐 Authentication (Optional)
            </span>
          </div>
          <span className="text-xs text-gray-500">{showAuth ? "▼" : "▶"}</span>
        </button>

        {showAuth && (
          <div className="px-2 pb-2 space-y-2 border-t border-gray-200 bg-white rounded-b-md">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Header Name
              </label>
              <input
                type="text"
                className="w-full p-1 border border-gray-200 rounded text-xs"
                placeholder="e.g., Authorization, X-API-Key"
                value={headerKey}
                onChange={(e) => {
                  setHeaderKey(e.target.value);
                  sessionStorage.setItem("mcpHeaderKey", e.target.value);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Bearer Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  className="w-full p-1 pr-8 border border-gray-200 rounded text-xs"
                  placeholder="Enter API key or token"
                  value={bearerToken}
                  onChange={(e) => {
                    setBearerToken(e.target.value);
                    sessionStorage.setItem("mcpBearerToken", e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-2 flex items-center"
                  onClick={() => setShowToken(!showToken)}
                >
                  <span className="text-xs text-gray-400">
                    {showToken ? "👁️" : "👁️‍🗨️"}
                  </span>
                </button>
              </div>
            </div>

            {headerKey && bearerToken && (
              <div className="text-xs text-gray-500">
                💡 Header: "{headerKey}: Bearer REDACTED"
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-2 space-x-2">
        {!serverUrl || state === "failed" ? (
          <button
            type="button"
            onClick={handleConnect}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs"
            disabled={!inputUrl.trim()}
          >
            Connect
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDisconnect}
            className="px-2 py-1 bg-red-500 text-white rounded text-xs"
          >
            Disconnect
          </button>
        )}
        <button
          type="button"
          onClick={authenticate}
          className="px-2 py-1 bg-purple-500 text-white rounded text-xs"
        >
          Auth
        </button>
        <button
          type="button"
          onClick={retry}
          className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
        >
          Retry
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium">Status:</span>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            state === "ready"
              ? "bg-green-100 text-green-800"
              : state === "failed"
                ? "bg-red-100 text-red-800"
                : state === "connecting" || state === "loading"
                  ? "bg-yellow-100 text-yellow-800"
                  : state === "authenticating" || state === "pending_auth"
                    ? "bg-purple-100 text-purple-800"
                    : state === "discovering"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
          }`}
        >
          {serverUrl ? state : "not-connected"}
        </span>
      </div>
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-xs">❌ {error}</p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium">Tools:</span>
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
          {tools?.length || 0} available
        </span>
      </div>

      {/* Show recent logs */}
      <div className="mb-2">
        <p className="text-xs font-semibold mb-1">📋 Recent logs:</p>
        <div className="bg-gray-50 dark:bg-gray-800 rounded border p-2 max-h-20 overflow-y-auto">
          {log.length > 0 ? (
            log.slice(-5).map((entry, i) => (
              <div
                key={`${entry.level}-${i}`}
                className={`text-xs font-mono ${
                  entry.level === "error"
                    ? "text-red-600"
                    : entry.level === "warn"
                      ? "text-yellow-600"
                      : entry.level === "info"
                        ? "text-blue-600"
                        : "text-gray-600"
                }`}
              >
                [{entry.level}] {entry.message}
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-400 italic">No logs yet</div>
          )}
        </div>
      </div>

      {/* Available Tools */}
      {tools && tools.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold mb-1">🛠️ Available Tools:</p>
          <div className="bg-white dark:bg-gray-900 border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-blue-700 dark:text-blue-300 truncate block">
                    {tool.name}
                  </span>
                  {tool.description && (
                    <span className="text-xs text-gray-500 truncate block">
                      {tool.description}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const result = await callTool(tool.name);
                      console.log(`🛠️ Tool ${tool.name} result:`, result);
                    } catch (err) {
                      console.error(`❌ Tool ${tool.name} error:`, err);
                    }
                  }}
                  className="ml-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
                >
                  Call
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
