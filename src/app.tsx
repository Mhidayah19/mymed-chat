import { useEffect, useState, useRef, useCallback } from "react";
import { Theme, Box, Flex, Grid } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import { agentFetch } from "agents/client";
import type { Message } from "@ai-sdk/react";
import { APPROVAL } from "./shared";
import type { tools } from "./tools";
// Server interface for MCP connections (matching McpSettings)
interface Server {
  id: string;
  name: string;
  url: string;
  transport: "SSE" | "HTTP";
  actualUrl: string;
  connected?: boolean;
}

// Type for booking templates response

import { Streamdown } from "streamdown";
import aiIcon from "./assets/AI.svg";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Input } from "@/components/input/Input";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { Tooltip } from "@/components/tooltip/Tooltip";
import { TextShimmer } from "@/components/text/text-shimmer";
import { Pill } from "@/components/pill/Pill";
import { AnimatedAiBot } from "@/components/animated-ai-bot/AnimatedAiBot";
import { cn } from "@/lib/utils";

// MyMediset Design System Components
import { OrganicShape } from "@/components/organic-shape/OrganicShape";
import {
  ChatBookingCard,
  parseBookingInfo,
  removeBookingsFromText,
} from "@/components/booking/ChatBookingCard";
import {
  GenericToolResultCard,
  parseToolResults,
  removeToolResultsFromText,
} from "@/components/tool/GenericToolResultCard";
import {
  ChatMaterialCard,
  parseMaterialInfo,
  removeMaterialsFromText,
} from "@/components/material/ChatMaterialCard";

// New enhanced components
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";
import McpSettings from "@/components/mcp/McpSettings";
import AddServerModal from "@/components/mcp/AddServerModal";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

// Icon imports
import {
  Bug,
  Gear,
  Moon,
  Robot,
  Sun,
  Trash,
  List,
  X,
  PaperPlaneTilt,
  Sliders,
} from "@phosphor-icons/react";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "createBooking",
  "updateBooking",
];

// Loading messages to show while the model is thinking
const loadingMessages = [
  "Thinking...",
  "Processing your request...",
  "Analyzing information...",
  "Searching for relevant data...",
  "Generating response...",
  "Considering options...",
  "Preparing answer...",
  "Checking available tools...",
  "Formulating response...",
  "Almost there...",
];

// Define CSS animations
const pulseAnimation = `
  @keyframes pulsate {
    0% {
      opacity: 0.6;
      transform: scale(0.98);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0.6;
      transform: scale(0.98);
    }
  }

  .loading-dots::after {
    content: "...";
    display: inline-block;
    overflow: hidden;
    vertical-align: bottom;
    animation: dots-animation 1.5s steps(4, end) infinite;
    width: 0;
  }

  @keyframes dots-animation {
    to {
      width: 1.25em;
    }
  }
`;

const organicAnimationStyles = `
  @keyframes organic-appear {
    0% {
      transform: scale(0.3) rotate(-30deg) translateY(100px);
      opacity: 0;
      filter: blur(20px) brightness(1.5);
    }
    30% {
      transform: scale(0.7) rotate(-10deg) translateY(30px);
      opacity: 0.3;
      filter: blur(10px) brightness(1.2);
    }
    70% {
      transform: scale(1.15) rotate(5deg) translateY(-10px);
      opacity: 0.8;
      filter: blur(2px) brightness(1.1);
    }
    85% {
      transform: scale(0.95) rotate(-2deg) translateY(5px);
      opacity: 0.9;
      filter: blur(1px) brightness(1.05);
    }
    100% {
      transform: scale(1) rotate(0deg) translateY(0px);
      opacity: 1;
      filter: blur(0) brightness(1);
    }
  }
  .organic-appear { animation: organic-appear 2000ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
`;

export default function Chat() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to light if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "light";
  });
  const [showDebug, setShowDebug] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const [showAddMcpDialog, setShowAddMcpDialog] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Welcome animation states
  const [showWelcomeInput, setShowWelcomeInput] = useState(false);
  const [showWelcomePills, setShowWelcomePills] = useState(false);
  const [showOrganicShapes, setShowOrganicShapes] = useState(false);

  // Track screen size for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const isLarge = window.innerWidth >= 1024;
      setIsLargeScreen(isLarge);
      
      // Reset sidebar state when switching between desktop/mobile
      if (isLarge) {
        setMobileMenuOpen(false);
      } else {
        setSidebarExpanded(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Add animation styles to head on mount
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.innerHTML = pulseAnimation + "\n" + organicAnimationStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  // Session management for conversation persistence
  const useSession = () => {
    const [sessionId] = useState(() => {
      // Check if we already have a session ID for this tab
      let id = sessionStorage.getItem('chat-session-id');
      if (!id) {
        // Only generate new ID if none exists
        id = `session-${Date.now()}-${crypto.randomUUID()}`;
        sessionStorage.setItem('chat-session-id', id);
      }
      return id;
    });
    return sessionId;
  };

  const sessionId = useSession();
  
  // Debug: Log session ID only once when component mounts
  useEffect(() => {
    console.log("🔍 Session initialized:", sessionId);
    console.log("🔍 Agent configuration:", { agent: "chat", name: sessionId });
  }, [sessionId]);

  const agent = useAgent({
    agent: "chat",
    name: sessionId, // Use session ID as the Durable Object name for isolation
  });

  const {
    messages: agentMessages,
    input: agentInput,
    handleInputChange: handleAgentInputChange,
    handleSubmit: handleAgentSubmit,
    addToolResult,
    clearHistory,
    isLoading,
  } = useAgentChat({
    agent,
    maxSteps: 5,
  });

  // Cycle through loading messages when isLoading is true
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) =>
          prev === loadingMessages.length - 1 ? 0 : prev + 1
        );
      }, 2000);

      return () => clearInterval(interval);
    } else {
      setLoadingMessageIndex(0);
    }
  }, [isLoading]);

  // Welcome animation sequence - only on first load when no messages
  useEffect(() => {
    if (agentMessages.length === 0 && !isLoading) {
      // Reset animation states
      setShowWelcomeInput(false);
      setShowWelcomePills(false);
      setShowOrganicShapes(false);
      
      // Staggered animation timers
      const shapesTimer = setTimeout(() => setShowOrganicShapes(true), 1000); // Shapes first
      const inputTimer = setTimeout(() => setShowWelcomeInput(true), 1200); // Earlier - overlaps with shapes
      const pillsTimer = setTimeout(() => setShowWelcomePills(true), 1400); // Earlier - shortly after input
      
      return () => {
        clearTimeout(shapesTimer);
        clearTimeout(inputTimer);
        clearTimeout(pillsTimer);
      };
    }
  }, [agentMessages.length, isLoading]);

  // Scroll to bottom when messages change
  useEffect(() => {
    agentMessages.length > 0 && scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  // Also scroll when loading state changes
  useEffect(() => {
    isLoading && scrollToBottom();
  }, [isLoading, scrollToBottom]);

  // Load MCP servers (same logic as McpSettings)
  useEffect(() => {
    const loadConnectedServers = async () => {
      if (!agent?.host) return; // Wait for agent to be ready

      try {
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

          if (result.success !== false && result.servers) {
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
            setServers([]);
          }
        } else {
          setServers([]);
        }
      } catch (error) {
        console.error("❌ Error loading MCP servers:", error);
      }
    };

    loadConnectedServers();
  }, [agent?.host]);

  const pendingToolCallConfirmation = agentMessages.some((m: Message) =>
    m.parts?.some(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        toolsRequiringConfirmation.includes(
          part.toolInvocation.toolName as keyof typeof tools
        )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Mobile menu toggle
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };


  // Sidebar hover handlers with debouncing (desktop only)
  const handleSidebarMouseEnter = useCallback(() => {
    // Only enable hover expand on larger screens
    if (isLargeScreen) {
      setSidebarExpanded(true);
    }
  }, [isLargeScreen]);

  const handleSidebarMouseLeave = useCallback(() => {
    // Only enable hover collapse on larger screens
    if (isLargeScreen) {
      setSidebarExpanded(false);
    }
  }, [isLargeScreen]);

  // Find active tool if any
  const getActiveToolName = () => {
    if (!isLoading) return null;

    // Check last few messages for any tool invocation
    const recentMessages = [...agentMessages].reverse().slice(0, 3);

    for (const message of recentMessages) {
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation.state === "call"
          ) {
            return part.toolInvocation.toolName;
          }
        }
      }
    }

    return null;
  };

  const activeToolName = getActiveToolName();

  // Helper to determine if sidebar should show expanded content
  const shouldShowExpanded = () => {
    return sidebarExpanded || !isLargeScreen;
  };

  // Shared pill section component - now responsive to sidebar state
  const PillSection = ({ className }: { className?: string }) => (
    <div className={cn("flex flex-wrap justify-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 max-w-5xl mx-auto px-1 sm:px-2", className)}>
      <Pill 
        size="md"
        onPillClick={(text) => {
          handleAgentInputChange({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>);
        }}>Create Dr Stephen usual booking</Pill>
      <Pill 
        size="md"
        onPillClick={(text) => {
          handleAgentInputChange({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>);
        }}>Recommend some bookings</Pill>
      <Pill 
        size="md"
        onPillClick={(text) => {
          handleAgentInputChange({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>);
        }}>Proceed</Pill>
    </div>
  );

  // Function to refresh MCP servers (extracted for reuse)
  const loadConnectedServers = async () => {
    if (!agent?.host) return;

    try {
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

        if (result.success !== false && result.servers) {
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
          setServers([]);
        }
      } else {
        setServers([]);
      }
    } catch (error) {
      console.error("❌ Error loading MCP servers:", error);
    }
  };

  // MCP Server Management Functions (copied from McpSettings)
  const handleAddMcpServer = (newServer: Server) => {
    const serverWithStatus = {
      ...newServer,
      connected: false,
    };
    setServers([...servers, serverWithStatus]);
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
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
        setServers(servers.filter((server) => server.id !== serverId));
      } else {
        // Still remove from local state even if backend removal failed
        setServers(servers.filter((server) => server.id !== serverId));
      }
    } catch (error) {
      console.error("❌ Error removing MCP server:", error);
      // Still remove from local state even if request failed
      setServers(servers.filter((server) => server.id !== serverId));
    }
  };

  const handleConnectServer = async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    try {
      console.log("Connecting to MCP server via backend...");

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
          authUrl?: string;
        };
        
        console.log("✅ MCP server connected via backend:", result);
        
        // Fix: The authUrl can be directly in result or in result.result
        const authUrl = (result as any).authUrl || result.result?.authUrl;

        // If OAuth is required, open auth window
        if (authUrl) {
          console.log("🔐 OAuth required, opening auth window...");
          const authWindow = window.open(
            authUrl,
            "mcpAuth",
            "width=600,height=800,resizable=yes,scrollbars=yes,toolbar=yes,menubar=no,location=no,directories=no,status=yes"
          );

          // Poll for when the OAuth window closes
          const pollTimer = setInterval(() => {
            if (authWindow?.closed) {
              clearInterval(pollTimer);
              console.log("🔐 OAuth window closed, refreshing server status...");
              // Refresh server status after OAuth flow
              setTimeout(() => {
                loadConnectedServers();
              }, 1000);
            }
          }, 1000);
        } else {
          console.log("ℹ️ No OAuth required - direct connection");
          // Refresh server list immediately
          setTimeout(() => {
            loadConnectedServers();
          }, 500);
        }
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
      }
    } catch (error) {
      console.error("❌ Error disconnecting server:", error);
    }
  };

  return (
    <Theme accentColor="cyan" grayColor="slate" radius="medium" scaling="100%" style={{ background: 'transparent' }}>
      <div className="h-screen w-full flex flex-col overflow-hidden relative" style={{ background: 'var(--color-background-primary)' }}>
        <HasOpenAIKey />
        
        {/* Organic Shape Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className={`hidden sm:block absolute top-20 right-10 transform transition-all duration-[1500ms] ease-[cubic-bezier(0.175,0.885,0.32,1.4)] ${
            showOrganicShapes ? 'opacity-30 scale-100 translate-y-0 rotate-0' : 'opacity-0 scale-50 translate-y-20 -rotate-45'
          }`}>
            <OrganicShape variant="petal" size="xl" />
          </div>
          <div className={`hidden sm:block absolute top-1/2 right-1/3 transform transition-all duration-[1800ms] ease-[cubic-bezier(0.23,1,0.32,1)] delay-[300ms] ${
            showOrganicShapes ? 'opacity-25 scale-100 translate-y-0 rotate-0' : 'opacity-0 scale-[0.3] translate-y-32 rotate-180'
          }`}>
            <OrganicShape variant="crystal" size="md" />
          </div>
        </div>

      {/* Layout Container */}
      <div className="flex flex-1 h-full overflow-hidden relative z-10">

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/50 z-30 lg:hidden"
            onClick={toggleMobileMenu}
          />
        )}

        {/* Collapsible Hover Sidebar */}
        <div
          className={`fixed top-0 left-0 h-screen z-40 lg:z-30 transition-all duration-300 ease-out bg-slate-50 border-r border-neutral-200 dark:border-neutral-800 shadow-lg 
            ${sidebarExpanded ? "lg:w-64" : "lg:w-16"}
            lg:translate-x-0
            ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            w-64
            pt-16 /* Add top padding equal to header height */
          `}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
          {/* Navigation Items */}
          <div className="px-3 py-2 w-full pt-8">
            <div className="space-y-2 w-full flex flex-col">

              {/* Theme Toggle */}
              <div className="w-full flex">
                <Tooltip className="w-full" content="Theme">
                  <div
                    className={`flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-md transition-all duration-300 flex-1 ${
                      shouldShowExpanded() ? "p-3 justify-between" : "p-3 justify-center"
                    }`}
                  >
                  {shouldShowExpanded() ? (
                    <>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                        <span className="text-sm truncate">Theme</span>
                      </div>
                      <div className="flex-shrink-0">
                        <Toggle
                          toggled={theme === "dark"}
                          aria-label="Toggle theme"
                          onClick={toggleTheme}
                        />
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={toggleTheme}
                      className="p-0 bg-transparent border-none cursor-pointer"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                    </button>
                  )}
                  </div>
                </Tooltip>
              </div>

              {/* Debug Mode Toggle */}
              <div className="w-full flex">
                <Tooltip className="w-full" content="Debug Mode">
                  <div
                    className={`flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-md transition-all duration-300 flex-1 ${
                      shouldShowExpanded() ? "p-3 justify-between" : "p-3 justify-center"
                    }`}
                  >
                  {shouldShowExpanded() ? (
                    <>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Bug size={16} />
                        <span className="text-sm truncate">Debug Mode</span>
                      </div>
                      <div className="flex-shrink-0">
                        <Toggle
                          toggled={showDebug}
                          aria-label="Toggle debug mode"
                          onClick={() => setShowDebug((prev) => !prev)}
                        />
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowDebug((prev) => !prev)}
                      className={`p-0 bg-transparent border-none cursor-pointer ${
                        showDebug ? "text-blue-500" : ""
                      }`}
                      aria-label="Toggle debug mode"
                    >
                      <Bug size={16} />
                    </button>
                  )}
                  </div>
                </Tooltip>
              </div>

              {/* MCP Settings */}
              <div className="w-full flex">
                <Tooltip className="w-full" content="MCP Settings">
                  <div
                    className={`flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-md transition-all duration-300 flex-1 ${
                      shouldShowExpanded() ? "p-3 justify-between" : "p-3 justify-center"
                    }`}
                  >
                  {shouldShowExpanded() ? (
                    <>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Gear size={16} />
                        <span className="text-sm truncate">AI Analysis & MCP</span>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="circular"
                          className="h-6 w-6"
                          onClick={() => setShowMcpPanel(!showMcpPanel)}
                        >
                          <Gear size={14} />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowMcpPanel(!showMcpPanel)}
                      className="p-0 bg-transparent border-none cursor-pointer"
                      aria-label="Open MCP Settings"
                    >
                      <Gear size={16} />
                    </button>
                  )}
                  </div>
                </Tooltip>
              </div>

              {/* Divider */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 my-4" />

              {/* Clear Conversation */}
              <div className="w-full">
                <Tooltip content="Clear conversation">
                  <div
                    className={`transition-all duration-300 w-full ${
                      shouldShowExpanded() ? "" : "flex justify-center"
                    }`}
                  >
                  {shouldShowExpanded() ? (
                    <Button
                      variant="ghost"
                      size="md"
                      className="w-full justify-start text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 px-3 py-3"
                      onClick={clearHistory}
                    >
                      <Trash size={16} className="mr-2" />
                      Clear conversation
                    </Button>
                  ) : (
                    <button
                      onClick={clearHistory}
                      className="p-3 bg-transparent border-none cursor-pointer text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      aria-label="Clear conversation"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Header - starts after sidebar on desktop */}
        <header className={`fixed top-0 right-0 bg-white h-16 px-4 flex items-center justify-between z-50 left-0 transition-all duration-300 ease-out ${
          isLargeScreen ? (sidebarExpanded ? 'lg:left-64' : 'lg:left-16') : ''
        }`}>
          <Flex align="center">
            {/* Mobile hamburger button - only visible on small screens */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="rounded-full mr-2"
                onClick={toggleMobileMenu}
              >
                <List size={20} />
              </Button>
            </div>
            <Flex align="center" className="px-4 py-3">
              <img src="/favicon.png" alt="MyMediset Logo" className="h-12" />
              <span className="ml-2 text-lg font-semibold truncate text-black font-pacifico">
              Agent
              </span>
            </Flex>
          </Flex>
          <Flex align="center" gap="2">
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="rounded-full"
              onClick={clearHistory}
            >
              <Trash size={18} />
            </Button>
          </Flex>
        </header>

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col h-full bg-transparent pt-16 transition-all duration-300 ease-out ${
          isLargeScreen ? (sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16') : ''
        }`}>
            
          {/* Scrollable Content Area - from header to form */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500 bg-white">
            {agentMessages.length === 0 && !isLoading ? (
              /* Welcome Mode - Center everything together */
              <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 relative">
              {/* Welcome Content */}
              <div className="mb-8">
                <AnimatedAiBot />
                <OrganicShape variant="petal" size="lg" className="hidden sm:block absolute top-10 right-20 opacity-40 organic-appear" />
                <OrganicShape variant="crystal" size="md" className="hidden md:block absolute bottom-60 left-30 opacity-30 organic-appear" />
              </div>
                
                {/* Centered Input Area */}
                <div className={`w-[95%] sm:w-full max-w-5xl transition-all duration-[1200ms] ease-[cubic-bezier(0.175,0.885,0.32,1.4)] ${
                  showWelcomeInput 
                    ? 'opacity-100 translate-y-0 scale-100 blur-0' 
                    : 'opacity-0 translate-y-16 scale-90 blur-sm'
                }`}>
                  
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAgentSubmit(e);
                    }}
                    className="w-full"
                  >
                    <div className="relative w-full">
                      <div className="relative rounded-full p-0.5 shadow-sm"
                           style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)' }}>
                        <div className="relative flex items-center bg-ob-btn-secondary-bg rounded-full py-2">
                          {/* AI icon on the left */}
                          <div className="pl-6 pr-4">
                            <img src={aiIcon} alt="AI" className="w-5 h-5 opacity-60" />
                          </div>
                          
                          <Input
                            disabled={pendingToolCallConfirmation || isLoading}
                            placeholder="Ask anything"
                            className="flex-1 bg-transparent border-0 h-16 text-lg px-0
                              focus:outline-none focus:ring-0 focus:border-0
                              file:border-0 file:bg-transparent file:text-base file:font-medium
                              placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                            value={agentInput}
                            onChange={handleAgentInputChange}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAgentSubmit(e as unknown as React.FormEvent);
                              }
                            }}
                            onValueChange={undefined}
                            spellCheck="false"
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            inputMode="search"
                            enterKeyHint="search"
                            aria-label="Ask anything"
                          />
                          
                          <Flex align="center" gap="2" className="mr-3">
                            <DropdownMenuPrimitive.Root>
                              <DropdownMenuPrimitive.Trigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  shape="circular"
                                  className="h-9 w-9 rounded-full"
                                  aria-label="MCP Control Panel"
                                  style={{background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(139, 92, 246, 0.2) 100%)'}}
                                >
                                  <Sliders size={16} />
                                </Button>
                              </DropdownMenuPrimitive.Trigger>
                              <DropdownMenuPrimitive.Portal>
                                <DropdownMenuPrimitive.Content
                                  align="end"
                                  side="top"
                                  className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl rounded-xl p-1 text-base font-medium text-neutral-900 dark:text-white z-50"
                                >
                                  <DropdownMenuPrimitive.Label className="px-2 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">MCP Connections</DropdownMenuPrimitive.Label>
                                  <DropdownMenuPrimitive.Separator className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />
                                  {servers.length === 0 && (
                                    <span className="p-3 text-neutral-500 dark:text-neutral-400 text-sm select-none text-center w-full">
                                      No MCP servers available.
                                    </span>
                                  )}
                                  {servers.map((server) => (
                                    <DropdownMenuPrimitive.Item
                                      key={server.id}
                                      className="flex items-center justify-between w-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors p-2 rounded-md cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <span className="flex items-center justify-center w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-xs border border-neutral-200 dark:border-neutral-700 mr-2">
                                          {(server.name || server.url).charAt(0).toUpperCase()}
                                        </span>
                                        <div className="flex flex-col">
                                          <span className="text-base text-neutral-900 dark:text-neutral-50">
                                            {server.name || server.url}
                                          </span>
                                          <span
                                            className={`text-xs font-medium lowercase tracking-wide align-middle mt-0.5 ${
                                              server.connected
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-red-600 dark:text-red-400"
                                            }`}
                                          >
                                            {server.connected ? "ready" : "disconnected"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {!server.connected ? (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            shape="square"
                                            className="rounded-full h-6 w-6 text-gray-400 hover:text-green-500"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              handleConnectServer(server.id);
                                            }}
                                            aria-label="Connect to server"
                                          >
                                            ▶
                                          </Button>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            shape="square"
                                            className="rounded-full h-6 w-6 text-gray-400 hover:text-red-500"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              handleDisconnectServer(server.id);
                                            }}
                                            aria-label="Disconnect from server"
                                          >
                                            ⏸
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          shape="square"
                                          className="rounded-full h-6 w-6"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleDeleteServer(server.id);
                                          }}
                                          aria-label="Remove MCP Server"
                                        >
                                          <Trash size={14} />
                                        </Button>
                                      </div>
                                    </DropdownMenuPrimitive.Item>
                                  ))}
                                  <DropdownMenuPrimitive.Separator className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />
                                  <DropdownMenuPrimitive.Item
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setShowAddMcpDialog(true);
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                    className="bg-primary/5 text-primary rounded-lg font-semibold px-3 py-2 hover:bg-primary/10 transition-colors cursor-pointer"
                                  >
                                    + Add MCP Server
                                  </DropdownMenuPrimitive.Item>
                                </DropdownMenuPrimitive.Content>
                              </DropdownMenuPrimitive.Portal>
                            </DropdownMenuPrimitive.Root>
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center h-9 w-9 rounded-full
                                transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed 
                                text-black hover:opacity-90
                                focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
                              style={{background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%)'}}
                              title="Send message"
                              disabled={
                                pendingToolCallConfirmation ||
                                isLoading ||
                                !agentInput.trim()
                              }
                            >
                              <PaperPlaneTilt size={18} className="rotate-45" />
                            </button>
                          </Flex>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              /* Messages Mode - Content within scrollable area */
              <div className="px-4 sm:px-6 py-4 sm:py-6">
                  <div className="max-w-[85%] sm:max-w-4xl mx-auto">
                    <div className="space-y-4 sm:space-y-6">
                      {agentMessages.map((m: Message, index) => {
                const isUser = m.role === "user";
                // const isLastMessage = index === agentMessages.length - 1;
                // // Check if this is a user message followed by an agent message
                // const isFollowedByAgentMessage =
                //   isUser &&
                //   index < agentMessages.length - 1 &&
                //   agentMessages[index + 1].role === "assistant";

                return (
                  <div key={m.id}>
                    {showDebug && (
                      <pre className="text-xs text-muted-foreground overflow-scroll">
                        {JSON.stringify(m, null, 2)}
                      </pre>
                    )}
                    <div
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex gap-1 sm:gap-2 ${
                          isUser ? "flex-row-reverse max-w-[85%] sm:max-w-[80%]" : "flex-row max-w-[90%] sm:max-w-[85%]"
                        }`}
                      >
                        {/* Avatar removed */}

                        <div className="w-full min-w-0 overflow-hidden">
                          <div>
                            {m.parts?.map((part, i) => {
                              if (part.type === "text") {
                                console.log(part.text);
                                // Check if the text contains booking information
                                const bookings = parseBookingInfo(part.text);
                                const textWithoutBookings =
                                  removeBookingsFromText(part.text);

                                return (
                                  // biome-ignore lint/suspicious/noArrayIndexKey: it's fine here
                                  <div key={i}>
                                    {isUser ? (
                                      <Card
                                        className={`p-3 sm:p-4 rounded-lg w-full rounded-br-none bg-black border border-gray-300 text-white ${
                                          part.text.startsWith(
                                            "scheduled message"
                                          )
                                            ? "border-accent/50"
                                            : ""
                                        } relative`}
                                      >
                                        {part.text.startsWith(
                                          "scheduled message"
                                        ) && (
                                          <span className="absolute -top-3 -left-2 text-base">
                                            🕒
                                          </span>
                                        )}
                                        {part.text.startsWith(
                                          "scheduled message"
                                        ) ? (
                                          <p className="text-sm sm:text-base whitespace-pre-wrap">
                                            {part.text.replace(
                                              /^scheduled message: /,
                                              ""
                                            )}
                                          </p>
                                        ) : (
                                          <div className="prose dark:prose-invert prose-sm sm:prose-base max-w-none">
                                            <Streamdown>{part.text}</Streamdown>
                                          </div>
                                        )}
                                      </Card>
                                    ) : (
                                      <div className="w-full max-w-full">
                                        {part.text.startsWith(
                                          "scheduled message"
                                        ) ? (
                                          <div className="relative w-full">
                                            <span className="absolute -top-3 -left-2 text-base">
                                              🕒
                                            </span>
                                            <p className="text-sm sm:text-base whitespace-pre-wrap text-gray-600 w-full">
                                              {part.text.replace(
                                                /^scheduled message: /,
                                                ""
                                              )}
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="prose dark:prose-invert prose-sm sm:prose-base max-w-full text-gray-600 w-full break-words overflow-wrap-anywhere">
                                            {/* Process all card types */}
                                            {(() => {
                                              // Parse generic tool results
                                              const toolResults = parseToolResults(
                                                part.text
                                              );
                                              let remainingText = removeToolResultsFromText(
                                                part.text
                                              );

                                              // Parse regular bookings from remaining text
                                              const bookings = parseBookingInfo(
                                                remainingText
                                              );
                                              remainingText = removeBookingsFromText(
                                                remainingText
                                              );

                                              // Finally parse materials from remaining text
                                              const materials =
                                                parseMaterialInfo(
                                                  remainingText
                                                );
                                              const textWithoutMaterials =
                                                removeMaterialsFromText(
                                                  remainingText
                                                );

                                              // Return clean text and all card types
                                              return (
                                                <>
                                                  <Streamdown>{textWithoutMaterials}</Streamdown>

                                                  {toolResults.length > 0 && (
                                                    <div className="mt-3">
                                                      {toolResults.map(
                                                        (result, idx) => (
                                                          <GenericToolResultCard
                                                            key={idx}
                                                            result={result}
                                                          />
                                                        )
                                                      )}
                                                    </div>
                                                  )}

                                                  {bookings.length > 0 && (
                                                    <div className="mt-3">
                                                      {bookings.map(
                                                        (booking, idx) => (
                                                          <ChatBookingCard
                                                            key={idx}
                                                            booking={booking}
                                                          />
                                                        )
                                                      )}
                                                    </div>
                                                  )}

                                                  {materials.length > 0 && (
                                                    <div className="mt-3">
                                                      {materials.map(
                                                        (material, idx) => (
                                                          <ChatMaterialCard
                                                            key={idx}
                                                            material={material}
                                                          />
                                                        )
                                                      )}
                                                    </div>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    <p
                                      className={`text-[10px] sm:text-xs text-muted-foreground mt-1 ${
                                        isUser ? "text-right" : "text-left"
                                      }`}
                                    >
                                      {formatTime(
                                        new Date(
                                          m.createdAt as unknown as string
                                        )
                                      )}
                                    </p>
                                  </div>
                                );
                              }

                              if (part.type === "tool-invocation") {
                                const toolInvocation = part.toolInvocation;
                                const toolCallId = toolInvocation.toolCallId;

                                if (
                                  toolsRequiringConfirmation.includes(
                                    toolInvocation.toolName as keyof typeof tools
                                  ) &&
                                  toolInvocation.state === "call"
                                ) {
                                  return (
                                    <Card
                                      // biome-ignore lint/suspicious/noArrayIndexKey: it's fine here
                                      key={i}
                                      className="p-3 sm:p-4 my-2 sm:my-3 rounded-md bg-neutral-100 dark:bg-neutral-900"
                                    >
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="bg-[rgb(0,104,120)]/10 p-1.5 rounded-full">
                                          <Robot
                                            size={16}
                                            className="text-[rgb(0,104,120)]"
                                          />
                                        </div>
                                        <h4 className="font-medium text-sm sm:text-base">
                                          <TextShimmer
                                            className="text-[rgb(0,104,120)]"
                                            duration={1.5}
                                          >
                                            {toolInvocation.toolName}
                                          </TextShimmer>
                                        </h4>
                                      </div>

                                      <div className="mb-3">
                                        <h5 className="text-[10px] sm:text-xs font-medium mb-1 text-muted-foreground">
                                          Arguments:
                                        </h5>
                                        <pre className="bg-background/80 p-1.5 sm:p-2 rounded-md text-[10px] sm:text-xs overflow-auto">
                                          {JSON.stringify(
                                            toolInvocation.args,
                                            null,
                                            2
                                          )}
                                        </pre>
                                      </div>

                                      <div className="flex gap-2 justify-end">
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          className="text-xs"
                                          onClick={() =>
                                            addToolResult({
                                              toolCallId,
                                              result: APPROVAL.NO,
                                            })
                                          }
                                        >
                                          Reject
                                        </Button>
                                        <Tooltip content={"Accept action"}>
                                          <Button
                                            variant="primary"
                                            size="sm"
                                            className="text-xs"
                                            onClick={() =>
                                              addToolResult({
                                                toolCallId,
                                                result: APPROVAL.YES,
                                              })
                                            }
                                          >
                                            Approve
                                          </Button>
                                        </Tooltip>
                                      </div>
                                    </Card>
                                  );
                                } else {
                                  // Use ToolInvocationCard for other tool invocations
                                  return (
                                    <ToolInvocationCard
                                      // biome-ignore lint/suspicious/noArrayIndexKey: it's fine here
                                      key={i}
                                      toolInvocation={toolInvocation}
                                      toolCallId={toolCallId}
                                      needsConfirmation={false}
                                      addToolResult={addToolResult}
                                    />
                                  );
                                }
                                return null;
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
                      })}
                      
                      {/* Loading animation showing active tool or just "Thinking..." */}
                      {isLoading && (
                        <div className="flex justify-start mt-2 mb-4">
                          <div className="w-full max-w-[98%] pl-2">
                            <TextShimmer
                              className="text-base font-medium"
                              duration={1.5}
                            >
                              {activeToolName
                                ? `Using ${activeToolName}...`
                                : "Thinking..."}
                            </TextShimmer>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    {/* Spacer for floating input area */}
                    <div className="h-32 sm:h-36" />
                  </div>
                </div>
              )}
          </div>
          
          {(agentMessages.length === 0 && !isLoading) && (
            <div className={`absolute right-0 flex justify-center z-30 px-2 sm:px-4 transition-all duration-[1500ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
              showWelcomePills 
                ? 'opacity-100 translate-y-0 scale-100 blur-0' 
                : 'opacity-0 translate-y-12 scale-75 blur-md'
            } ${
              isLargeScreen ? (sidebarExpanded ? 'lg:left-64' : 'lg:left-16') : 'left-0'
            }`}
                 style={{
                   bottom: 'calc(5rem + env(safe-area-inset-bottom) + 16px)'
                 }}>
              <PillSection className="w-full justify-center" />
            </div>
          )}
          {(agentMessages.length > 0 || isLoading) && (
            <div className={`fixed bottom-0 right-0 z-40 p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-300 ease-out ${
              isLargeScreen ? (sidebarExpanded ? 'lg:left-64' : 'lg:left-16') : 'left-0'
            }`}
                 style={{ 
                   background: 'linear-gradient(to bottom, transparent 0%, transparent 50%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,1) 100%)'
                 }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAgentSubmit(e);
                }}
                className="w-full"
              >
                <div className="relative w-[95%] sm:w-full max-w-5xl mx-auto">
                  <div className="relative rounded-full p-0.5 shadow-sm"
                       style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)' }}>
                    <div className="relative flex items-center bg-ob-btn-secondary-bg rounded-full py-2">
                      {/* AI icon on the left */}
                      <div className="pl-6 pr-4">
                        <img src={aiIcon} alt="AI" className="w-5 h-5 opacity-60" />
                      </div>

                      <Input
                        disabled={pendingToolCallConfirmation || isLoading}
                        placeholder="Ask anything"
                        className="flex-1 bg-transparent border-0 h-16 text-lg px-0
                          focus:outline-none focus:ring-0 focus:border-0
                          file:border-0 file:bg-transparent file:text-base file:font-medium
                          placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                        value={agentInput}
                        onChange={handleAgentInputChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAgentSubmit(e as unknown as React.FormEvent);
                          }
                        }}
                        onValueChange={undefined}
                        spellCheck="false"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        inputMode="search"
                        enterKeyHint="search"
                        aria-label="Ask anything"
                      />

                      <Flex align="center" gap="2" className="mr-3">
                        <DropdownMenuPrimitive.Root>
                          <DropdownMenuPrimitive.Trigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              shape="circular"
                              className="h-9 w-9 rounded-full"
                              aria-label="MCP Control Panel"
                              style={{background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(139, 92, 246, 0.2) 100%)'}}
                            >
                              <Sliders size={16} />
                            </Button>
                          </DropdownMenuPrimitive.Trigger>
                          <DropdownMenuPrimitive.Portal>
                            <DropdownMenuPrimitive.Content
                              align="end"
                              side="top"
                              className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl rounded-xl p-1 text-base font-medium text-neutral-900 dark:text-white z-50"
                            >
                              <DropdownMenuPrimitive.Label className="px-2 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">MCP Connections</DropdownMenuPrimitive.Label>
                              <DropdownMenuPrimitive.Separator className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />
                              {servers.length === 0 && (
                                <span className="p-3 text-neutral-500 dark:text-neutral-400 text-sm select-none text-center w-full">
                                  No MCP servers available.
                                </span>
                              )}
                              {servers.map((server) => (
                                <DropdownMenuPrimitive.Item
                                  key={server.id}
                                  className="flex items-center justify-between w-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors p-2 rounded-md cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="flex items-center justify-center w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-xs border border-neutral-200 dark:border-neutral-700 mr-2">
                                      {(server.name || server.url).charAt(0).toUpperCase()}
                                    </span>
                                    <div className="flex flex-col">
                                      <span className="text-base text-neutral-900 dark:text-neutral-50">
                                        {server.name || server.url}
                                      </span>
                                      <span
                                        className={`text-xs font-medium lowercase tracking-wide align-middle mt-0.5 ${
                                          server.connected
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                        }`}
                                      >
                                        {server.connected ? "ready" : "disconnected"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {!server.connected ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        shape="square"
                                        className="rounded-full h-6 w-6 text-gray-400 hover:text-green-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          handleConnectServer(server.id);
                                        }}
                                        aria-label="Connect to server"
                                      >
                                        ▶
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        shape="square"
                                        className="rounded-full h-6 w-6 text-gray-400 hover:text-red-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          handleDisconnectServer(server.id);
                                        }}
                                        aria-label="Disconnect from server"
                                      >
                                        ⏸
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      shape="square"
                                      className="rounded-full h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleDeleteServer(server.id);
                                      }}
                                      aria-label="Remove MCP Server"
                                    >
                                      <Trash size={14} />
                                    </Button>
                                  </div>
                                </DropdownMenuPrimitive.Item>
                              ))}
                              <DropdownMenuPrimitive.Separator className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />
                              <DropdownMenuPrimitive.Item
                                onClick={(e) => {
                                  e.preventDefault();
                                  setShowAddMcpDialog(true);
                                }}
                                onSelect={(e) => e.preventDefault()}
                                className="bg-primary/5 text-primary rounded-lg font-semibold px-3 py-2 hover:bg-primary/10 transition-colors cursor-pointer"
                              >
                                + Add MCP Server
                              </DropdownMenuPrimitive.Item>
                            </DropdownMenuPrimitive.Content>
                          </DropdownMenuPrimitive.Portal>
                        </DropdownMenuPrimitive.Root>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center h-9 w-9 rounded-full
                            transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed 
                            text-black hover:opacity-90
                            focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
                          style={{background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%)'}}
                          title="Send message"
                          disabled={
                            pendingToolCallConfirmation ||
                            isLoading ||
                            !agentInput.trim()
                          }
                        >
                          <PaperPlaneTilt size={18} className="rotate-45" />
                        </button>
                      </Flex>
                    </div>
                  </div>
                </div>
              </form>
              
              {/* Pills section - only show when no messages */}
              {agentMessages.length === 0 && <PillSection className="mt-4 md:mt-6" />}
              
              {/* Disclaimer text */}
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  mymediset Agent can make mistakes. Check important info and actions.
                </p>
              </div>
            </div>
          )}
    </div>
  </div>

      {/* MCP Settings Panel - positioned as an overlay when showMcpPanel is true */}
      {showMcpPanel && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl rounded-md w-full max-w-4xl h-[80vh] overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Panel Header */}
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8">
                  <Gear size={20} className="text-[rgb(0,104,120)]" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-base text-[rgb(0,104,120)]">
                    AI Analysis & MCP Settings
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Configure AI booking analysis and Model Context Protocol
                    servers
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  className="rounded-full h-8 w-8"
                  onClick={() => setShowMcpPanel(false)}
                >
                  <X size={18} />
                </Button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <McpSettings agent={agent} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add MCP Server Modal */}
      <AddServerModal
        isOpen={showAddMcpDialog}
        onClose={() => setShowAddMcpDialog(false)}
        onAddServer={handleAddMcpServer}
      />
      </div>
    </Theme>
  );
}

function HasOpenAIKey() {
  const [hasOpenAiKey, setHasOpenAiKey] = useState<{ success: boolean } | null>(null);
  
  useEffect(() => {
    fetch("/check-open-ai-key")
      .then((res) => res.json<{ success: boolean }>())
      .then(setHasOpenAiKey)
      .catch(() => setHasOpenAiKey({ success: false }));
  }, []);
  
  if (!hasOpenAiKey) return null; // Loading state

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <Flex align="start" gap="3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-labelledby="warningIcon"
                >
                  <title id="warningIcon">Warning Icon</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <Box flexGrow="1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  Google Generative AI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until a Google Generative AI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure a Google Generative AI API key by setting a{" "}
                  <a
                    href="https://developers.cloudflare.com/workers/configuration/secrets/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    secret
                  </a>{" "}
                  named{" "}
                  <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
                    GOOGLE_GENERATIVE_AI_API_KEY
                  </code>
                  . <br />
                  You can also use a different model provider by following these{" "}
                  <a
                    href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    instructions.
                  </a>
                </p>
              </Box>
            </Flex>
          </div>
        </div>
      </div>
    );
  }
  return null;
}


