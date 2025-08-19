import { useEffect, useState, useRef, useCallback, use } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { Message } from "@ai-sdk/react";
import { APPROVAL } from "./shared";
import type { tools } from "./tools";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import mymLogo from "./assets/mymLogoTxt.svg";

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
  ChatMaterialCard,
  parseMaterialInfo,
  removeMaterialsFromText,
} from "@/components/material/ChatMaterialCard";

// Icon imports
import {
  Bug,
  Moon,
  PaperPlaneRight,
  Robot,
  Sun,
  Trash,
  List,
  X,
} from "@phosphor-icons/react";

// BookingCard component
interface BookingInfo {
  id?: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  status?: string;
}

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
  "Almost there..."
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
    const styleElement = document.createElement('style');
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

  const agent = useAgent({
    agent: "chat",
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
        setLoadingMessageIndex(prev => 
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
          if (part.type === "tool-invocation" && part.toolInvocation.state === "call") {
            return part.toolInvocation.toolName;
          }
        }
      }
    }
    
    return null;
  };

  const activeToolName = getActiveToolName();

  return (
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
                <span className="ml-2 font-semibold text-sm sm:text-base">
                  Agent
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
          <div className="flex-1 overflow-y-auto p-1 sm:p-2 space-y-3 sm:space-y-4 pb-20 sm:pb-24">
            {agentMessages.length === 0 && !isLoading && (
              <div className="h-full flex items-center justify-center">
                <Card className="p-6 sm:p-8 max-w-[90%] sm:max-w-md mx-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
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
                      Your personal assistant at your service. Try asking about:
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
                            Schedule tasks for later
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
                                    className={`p-2 sm:p-3 rounded-md w-full ${
                                      isUser
                                        ? "rounded-br-none bg-neutral-100 dark:bg-neutral-900"
                                        : "rounded-bl-none border-assistant-border bg-transparent border border-neutral-200 dark:border-neutral-800"
                                    } ${
                                      part.text.startsWith("scheduled message")
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
                                      <p className="text-xs sm:text-sm whitespace-pre-wrap">
                                        {part.text.replace(
                                          /^scheduled message: /,
                                          ""
                                        )}
                                      </p>
                                    ) : (
                                      <div
                                        className={`prose ${isUser ? "dark:prose-invert" : "dark:prose-invert"} prose-xs sm:prose-sm max-w-none`}
                                      >
                                        {/* Process material information first */}
                                        {(() => {
                                          // First remove bookings, then remove materials
                                          const materials = parseMaterialInfo(part.text);
                                          const textWithoutMaterials = removeMaterialsFromText(textWithoutBookings);
                                          
                                          // Return both the clean text and the materials info
                                          return (
                                            <>
                                              {/* @ts-ignore - TypeScript issues with ReactMarkdown components */}
                                              <ReactMarkdown
                                                children={textWithoutMaterials}
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
                                                        style={{ maxWidth: "300px" }}
                                                      />
                                                    );
                                                  },
                                                }}
                                              />

                                              {bookings.length > 0 && (
                                                <div className="mt-3">
                                                  {bookings.map((booking, idx) => (
                                                    <ChatBookingCard
                                                      key={idx}
                                                      booking={booking}
                                                    />
                                                  ))}
                                                </div>
                                              )}

                                              {materials.length > 0 && (
                                                <div className="mt-3">
                                                  {materials.map((material, idx) => (
                                                    <ChatMaterialCard
                                                      key={idx}
                                                      material={material}
                                                    />
                                                  ))}
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
                                      new Date(m.createdAt as unknown as string)
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
                  <TextShimmer className="text-base font-medium" duration={1.5}>
                    {activeToolName ? `Using ${activeToolName}...` : "Thinking..."}
                  </TextShimmer>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) =>
              handleAgentSubmit(e, {
                data: {
                  annotations: {
                    hello: "world",
                  },
                },
              })
            }
            className="p-2 sm:p-3 bg-input-background border-t border-neutral-200 dark:border-neutral-800 relative"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  disabled={pendingToolCallConfirmation || isLoading}
                  placeholder={
                    pendingToolCallConfirmation
                      ? "Please respond to the tool confirmation above..."
                      : isLoading
                        ? "Waiting for response..."
                        : "Type your message..."
                  }
                  className="pl-3 sm:pl-4 pr-8 sm:pr-10 py-1.5 sm:py-2 w-full rounded-full text-sm"
                  value={agentInput}
                  onChange={handleAgentInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAgentSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  onValueChange={undefined}
                />
              </div>

              <Button
                type="submit"
                shape="square"
                className="rounded-full h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
                disabled={
                  pendingToolCallConfirmation || isLoading || !agentInput.trim()
                }
              >
                <PaperPlaneRight size={16} />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
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
