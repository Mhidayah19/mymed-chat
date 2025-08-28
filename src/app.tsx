import { useEffect, useState, useRef, useCallback, use } from "react";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import { agentFetch } from "agents/client";
import type { Message } from "@ai-sdk/react";
import { APPROVAL } from "./shared";
import type { tools } from "./tools";

// Type for booking templates response

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import mymLogo from "./assets/mymediset_monogram_colour_RGB_AW.svg";
import aiIcon from "./assets/AI.svg";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Input } from "@/components/input/Input";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { Tooltip } from "@/components/tooltip/Tooltip";
import { TextShimmer } from "@/components/text/text-shimmer";
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
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";
import McpSettings from "@/components/mcp/McpSettings";

// Icon imports
import {
  Bug,
  Gear,
  Moon,
  PaperPlaneRight,
  Robot,
  Sun,
  Trash,
  List,
  X,
  Sparkle,
  PaperPlaneTilt,
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

export default function Chat() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  const [showDebug, setShowDebug] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

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
    styleElement.innerHTML = pulseAnimation;
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
      let id = localStorage.getItem('chat-session-id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('chat-session-id', id);
      }
      return id;
    });
    return sessionId;
  };

  const sessionId = useSession();

  const agent = useAgent({
    agent: "chat",
    id: sessionId, // Use session ID as the instance ID
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

  // Scroll to bottom when messages change
  useEffect(() => {
    agentMessages.length > 0 && scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  // Also scroll when loading state changes
  useEffect(() => {
    isLoading && scrollToBottom();
  }, [isLoading, scrollToBottom]);

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

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

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

  return (
    <Theme accentColor="cyan" grayColor="slate" radius="medium" scaling="100%">
      <div className="h-screen w-full flex flex-col bg-fixed overflow-hidden bg-white dark:bg-gray-950">
        <HasOpenAIKey />

      {/* Layout Container */}
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Overlay for mobile */}
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/50 z-20 lg:hidden"
            onClick={toggleDrawer}
          />
        )}

        {/* Drawer/Sidebar */}
        <div
          className={`fixed lg:fixed w-64 h-full z-30 transform transition-transform duration-300 ease-in-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          } bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 shadow-lg`}
        >
          <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center">{/* Logo removed */}</div>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="rounded-full lg:hidden"
              onClick={toggleDrawer}
            >
              <X size={18} />
            </Button>
          </div>

          <div className="p-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Settings</h3>
                <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md">
                  <div className="flex items-center gap-2">
                    {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                    <span className="text-sm">Theme</span>
                  </div>
                  <Toggle
                    toggled={theme === "dark"}
                    aria-label="Toggle theme"
                    onClick={toggleTheme}
                  />
                </div>
                <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md mt-2">
                  <div className="flex items-center gap-2">
                    <Bug size={16} />
                    <span className="text-sm">Debug Mode</span>
                  </div>
                  <Toggle
                    toggled={showDebug}
                    aria-label="Toggle debug mode"
                    onClick={() => setShowDebug((prev) => !prev)}
                  />
                </div>
                <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md mt-2">
                  <div className="flex items-center gap-2">
                    <Gear size={16} />
                    <span className="text-sm">AI Analysis & MCP</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    className="rounded-full h-6 w-6"
                    onClick={() => setShowMcpPanel(!showMcpPanel)}
                  >
                    <Gear size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Available Tools</h3>
                <ul className="space-y-2">
                  <li className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[rgb(0,104,120)]">•</span>
                      <span>Booking Management</span>
                      <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex flex-col">
                        <span>Create</span>
                        <span>Update</span>
                        <span>View</span>
                      </div>
                    </div>
                  </li>
                  <li className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[rgb(0,104,120)]">•</span>
                      <span>Materials Management</span>
                      <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex flex-col">
                        <span>Track</span>
                        <span>View</span>
                        <span>Update</span>
                      </div>
                    </div>
                  </li>
                  <li className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[rgb(0,104,120)]">•</span>
                      <span>Task Scheduling</span>
                      <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex flex-col">
                        <span>Schedule</span>
                        <span>View</span>
                        <span>Cancel</span>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full justify-start text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                  onClick={clearHistory}
                >
                  <Trash size={16} className="mr-2" />
                  Clear conversation
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col h-full max-h-screen overflow-hidden ${!drawerOpen ? "lg:ml-0" : "lg:ml-64"}`}
        >
          {/* Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="rounded-full mr-2"
                onClick={toggleDrawer}
              >
                <List size={20} />
              </Button>
              <div className="flex items-center">
                <img src={mymLogo} alt="MYM Logo" className="h-5" />
                <span className="ml-2 text-lg font-semibold truncate bg-gradient-to-r from-[#00D4FF] to-[#8B5CF6] bg-clip-text text-transparent">
                  mymediset Agent
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="rounded-full"
                onClick={clearHistory}
              >
                <Trash size={18} />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4 sm:space-y-6 pb-20 sm:pb-24" style={{ background: 'var(--color-chat-bg)' }}>
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
              {agentMessages.length === 0 && !isLoading && (
                <div className="h-full flex items-center justify-center pt-20">
                  <Card className="p-6 sm:p-8 max-w-[90%] sm:max-w-md mx-auto bg-white dark:bg-neutral-900 border border-neutral-400 dark:border-neutral-600">
                    <div className="text-center space-y-5">
                      <div className="bg-[rgb(0,104,120)]/10 text-[rgb(0,104,120)] rounded-full p-3 inline-flex mx-auto mb-2">
                        <Robot weight="duotone" size={24} />
                      </div>
                      <h3 className="font-semibold text-lg sm:text-xl text-[rgb(0,104,120)]">
                        <TextShimmer duration={2}>
                          Welcome to Mymediset Agent
                        </TextShimmer>
                      </h3>
                      <p className="text-muted-foreground text-sm mx-auto max-w-xs">
                        Your personal assistant at your service. Try asking
                        about:
                      </p>
                      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 mx-auto max-w-xs">
                        <ul className="text-sm text-left space-y-3">
                          <li className="flex items-center gap-3 group">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgb(0,104,120)]/10 flex items-center justify-center">
                              <span className="text-[rgb(0,104,120)] text-xs group-hover:scale-110 transition-transform">
                                →
                              </span>
                            </span>
                            <span className="text-neutral-700 dark:text-neutral-300 group-hover:text-[rgb(0,104,120)] transition-colors">
                              Create or update bookings
                            </span>
                          </li>
                          <li className="flex items-center gap-3 group">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgb(0,104,120)]/10 flex items-center justify-center">
                              <span className="text-[rgb(0,104,120)] text-xs group-hover:scale-110 transition-transform">
                                →
                              </span>
                            </span>
                            <span className="text-neutral-700 dark:text-neutral-300 group-hover:text-[rgb(0,104,120)] transition-colors">
                              Track and manage materials
                            </span>
                          </li>
                          <li className="flex items-center gap-3 group">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgb(0,104,120)]/10 flex items-center justify-center">
                              <span className="text-[rgb(0,104,120)] text-xs group-hover:scale-110 transition-transform">
                                →
                              </span>
                            </span>
                            <span className="text-neutral-700 dark:text-neutral-300 group-hover:text-[rgb(0,104,120)] transition-colors">
                              Create usual bookings
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

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
                        className={`flex gap-1 sm:gap-2 max-w-[98%] sm:max-w-[98%] ${
                          isUser ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Avatar removed */}

                        <div className="w-full">
                          <div>
                            {m.parts?.map((part, i) => {
                              if (part.type === "text") {
                                // Check if the text contains booking information
                                const bookings = parseBookingInfo(part.text);
                                const textWithoutBookings =
                                  removeBookingsFromText(part.text);

                                return (
                                  // biome-ignore lint/suspicious/noArrayIndexKey: it's fine here
                                  <div key={i}>
                                    <Card
                                      className={`p-3 sm:p-4 rounded-lg w-full ${
                                        isUser
                                          ? "rounded-br-none bg-[var(--color-chat-user-bubble)] border border-[var(--color-chat-user-border)] text-gray-600"
                                          : "rounded-bl-none bg-[var(--color-chat-ai-bubble)] border border-[var(--color-chat-ai-border)] text-gray-600 shadow-sm"
                                      } ${
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
                                        <div
                                          className={`prose ${isUser ? "dark:prose-invert" : "dark:prose-invert"} prose-sm sm:prose-base max-w-none`}
                                        >
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
                                                {/* @ts-ignore - TypeScript issues with ReactMarkdown components */}
                                                <ReactMarkdown
                                                  children={
                                                    textWithoutMaterials
                                                  }
                                                  components={{
                                                    code: ({ children }) => {
                                                      return (
                                                        <code
                                                          className={`${isUser ? "bg-neutral-300 dark:bg-neutral-600 text-neutral-900 dark:text-white border border-neutral-400 dark:border-neutral-500" : "bg-gray-800 text-white"} px-1 py-0.5 rounded`}
                                                        >
                                                          {children}
                                                        </code>
                                                      );
                                                    },
                                                    img: ({ src, alt }) => {
                                                      return (
                                                        <img
                                                          src={src}
                                                          alt={alt || ""}
                                                          className="rounded-md max-w-[300px] w-auto h-auto my-2"
                                                          loading="lazy"
                                                          style={{
                                                            maxWidth: "300px",
                                                          }}
                                                        />
                                                      );
                                                    },
                                                  }}
                                                />


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
                                    </Card>
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
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAgentSubmit(e);
            }}
            className="p-4 sm:p-6 bg-input-background relative"
          >
            <div className="relative w-full max-w-4xl mx-auto">
              <div className="relative rounded-full p-0.5 shadow-sm hover:shadow-md transition-shadow duration-200 bg-gray-200">
                <div className="relative flex items-center bg-white rounded-full py-2">
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
                
                <button
                  type="submit"
                  className="mr-3 inline-flex items-center justify-center h-9 w-9 rounded-full
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
                </div>
              </div>
            </div>
          </form>
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
    </div>
    </Theme>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean }>()
);

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
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
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until an OpenAI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key by setting a{" "}
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
                    OPENAI_API_KEY
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
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
