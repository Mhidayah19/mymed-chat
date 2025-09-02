import { useState } from "react";
import { Robot, CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Tooltip } from "@/components/tooltip/Tooltip";
import { TextShimmer } from "@/components/text/text-shimmer";
import { APPROVAL } from "@/shared";
import { 
  ListRecommendedCard, 
  RecommendedBookingCard, 
  BookingOperationResultCard
} from "../booking";
import type { 
  ContentResult,
  ToolInvocationResult
} from "@/types/ui";

interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: "call" | "result" | "partial-call";
  step?: number;
  args: Record<string, unknown>;
  result?: ToolInvocationResult;
}

interface ToolInvocationCardProps {
  toolInvocation: ToolInvocation;
  toolCallId: string;
  needsConfirmation: boolean;
  addToolResult: (args: { toolCallId: string; result: string }) => void;
}

export function ToolInvocationCard({
  toolInvocation,
  toolCallId,
  needsConfirmation,
  addToolResult,
}: ToolInvocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // User-friendly tool name mapping based on action patterns
  const getDisplayName = (toolName: string) => {
    const cleanedName = cleanToolName(toolName);
    
    // Extract action verb (first word) and subject (rest)
    const actionMatch = cleanedName.match(/^([a-z]+)(.*)$/i);
    if (!actionMatch) return { name: cleanedName, icon: "🔧" };
    
    const [, action, subject] = actionMatch;
    
    // Map action verbs to user-friendly equivalents
    const actionMap: Record<string, string> = {
      get: "Loading",
      create: "Creating",
      update: "Updating", 
      delete: "Removing",
      search: "Searching",
      find: "Finding",
      check: "Checking",
      track: "Tracking",
      schedule: "Scheduling",
      cancel: "Cancelling",
      confirm: "Confirming",
      send: "Sending",
      fetch: "Getting",
      load: "Loading",
      save: "Saving",
      export: "Exporting",
      import: "Importing",
    };

    // Map common subjects to icons
    const subjectIconMap: Record<string, string> = {
      booking: "🗓️",
      appointment: "📅", 
      patient: "👤",
      template: "📋",
      material: "📦",
      task: "⏰",
      recommendation: "💡",
      availability: "📅",
      schedule: "📆",
      report: "📊",
      notification: "🔔",
      email: "📧",
      data: "💾",
    };
    
    const userFriendlyAction = actionMap[action.toLowerCase()] || action;
    const subjectLower = subject.toLowerCase();
    const icon = Object.entries(subjectIconMap).find(([key]) => 
      subjectLower.includes(key)
    )?.[1] || "🔧";
    
    // Format subject nicely (camelCase to spaces)
    const formattedSubject = subject.replace(/([A-Z])/g, ' $1').trim() || "Item";
    
    return { 
      name: `${userFriendlyAction} ${formattedSubject}`, 
      icon 
    };
  };

  // Clean up MCP tool names by removing multiple prefixes (e.g., "qgu_zEu9_createBooking" -> "createBooking")
  const cleanToolName = (toolName: string) => {
    // Keep removing prefixes until we get to the actual tool name
    let cleaned = toolName;
    while (true) {
      const match = cleaned.match(/^[A-Za-z0-9\-]+_(.+)$/);
      if (match && match[1]) {
        cleaned = match[1];
      } else {
        break;
      }
    }
    return cleaned;
  };

  // Check if this is a UI-rendered tool and render the specialized component
  const cleanedToolName = cleanToolName(toolInvocation.toolName);
  
  // Debug logging
  if (toolInvocation.toolName.includes("createBooking") || toolInvocation.toolName.includes("updateBooking")) {
    console.log(`Tool name: "${toolInvocation.toolName}" -> cleaned: "${cleanedToolName}"`);
    console.log(`State: ${toolInvocation.state}`);
  }
  
  if ((cleanedToolName === "getCachedTemplates" || cleanedToolName === "getRecommendedBooking" || cleanedToolName === "createBooking" || cleanedToolName === "updateBooking") && toolInvocation.state === "result") {
    const result = toolInvocation.result as ToolInvocationResult;
    
    // Handle getRecommendedBooking - let component handle raw data
    if (cleanedToolName === "getRecommendedBooking") {
      return (
        <div className="w-full">
          <RecommendedBookingCard rawResult={result} />
        </div>
      );
    }
    
    // Handle createBooking/updateBooking - let component handle raw data
    else if (cleanedToolName === "createBooking" || cleanedToolName === "updateBooking") {
      console.log(`Raw ${cleanedToolName} response body:`, JSON.stringify(result, null, 2));
      console.log(`${cleanedToolName} request args:`, JSON.stringify(toolInvocation.args, null, 2));
      return (
        <div className="w-full">
          <BookingOperationResultCard 
            rawResult={result} 
            requestArgs={toolInvocation.args}
          />
        </div>
      );
    }
    
    // Handle getCachedTemplates - let component handle raw data
    else if (cleanedToolName === "getCachedTemplates") {
      return (
        <div className="w-full">
          <ListRecommendedCard rawResult={result} />
        </div>
      );
    }
  }

  return (
    <div
      className="p-3 sm:p-4 my-3 w-full rounded-bl-none overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 relative"
      style={{
        background: 'white',
        border: needsConfirmation 
          ? '2px solid transparent' 
          : '1px solid rgba(156, 163, 175, 0.2)',
        backgroundImage: needsConfirmation 
          ? 'linear-gradient(white, white), linear-gradient(135deg, rgba(255, 193, 7, 0.4) 0%, rgba(255, 152, 0, 0.4) 100%)'
          : 'linear-gradient(white, white), linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        backgroundOrigin: needsConfirmation ? 'border-box' : 'padding-box',
        backgroundClip: needsConfirmation ? 'content-box, border-box' : 'padding-box',
      }}
    >
      
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer relative z-10"
      >
        <div
          className="p-1.5 rounded-full flex-shrink-0"
          style={{
            background: needsConfirmation
              ? 'linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 152, 0, 0.2) 100%)'
              : 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)'
          }}
        >
          <Robot
            size={16}
            className={needsConfirmation ? "text-amber-600" : "text-cyan-600"}
          />
        </div>
        <h4 className="font-medium flex items-center gap-2 flex-1 text-left">
          {(() => {
            const displayInfo = getDisplayName(toolInvocation.toolName);
            return (
              <>
                <span className="text-base">{displayInfo.icon}</span>
                {toolInvocation.state === "call" ? (
                  <TextShimmer
                    className={needsConfirmation ? "text-amber-600" : "text-cyan-600"}
                    duration={1.5}
                  >
                    {displayInfo.name}
                  </TextShimmer>
                ) : (
                  displayInfo.name
                )}
                {!needsConfirmation && toolInvocation.state === "result" && (
                  <span className="text-xs text-emerald-600 font-medium animate-pulse">
                    ✅ Done
                  </span>
                )}
              </>
            );
          })()}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {isExpanded ? "Less" : "Details"}
          </span>
          <CaretDown
            size={16}
            className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <div
        className={`transition-all duration-300 relative z-10 ${isExpanded ? "max-h-[220px] opacity-100 mt-4" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div
          className="overflow-y-auto"
          style={{ maxHeight: isExpanded ? "200px" : "0px" }}
        >
          <div className="mb-4">
            <h5 className="text-xs font-semibold mb-2 text-gray-600">
              Details:
            </h5>
            <pre className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 p-2 sm:p-3 rounded-lg text-xs overflow-auto whitespace-pre-wrap break-words w-full max-w-[450px] shadow-inner">
              {JSON.stringify(toolInvocation.args, null, 2)}
            </pre>
          </div>

          {needsConfirmation && toolInvocation.state === "call" && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-all duration-200"
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
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)',
                  }}
                  onClick={() =>
                    addToolResult({
                      toolCallId,
                      result: APPROVAL.YES,
                    })
                  }
                >
                  Approve
                </button>
              </Tooltip>
            </div>
          )}

          {!needsConfirmation && toolInvocation.state === "result" && (
            <div className="mt-4 pt-4 border-t border-cyan-200">
              <h5 className="text-xs font-semibold mb-2 text-gray-600 flex items-center gap-2">
                Summary:
                <span className="text-xs text-emerald-600 font-medium">
                  ✅
                </span>
              </h5>
              <pre className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 p-2 sm:p-3 rounded-lg text-xs overflow-auto whitespace-pre-wrap break-words w-full max-w-[450px] shadow-inner">
                {(() => {
                  const result = toolInvocation.result;
                  if (typeof result === "object" && 'content' in result && result.content) {
                    const contentResult = result as ContentResult;
                    return contentResult.content?.map((item: { type: string; text: string }) => {
                        if (
                          item.type === "text" &&
                          item.text.startsWith("\n~ Page URL:")
                        ) {
                          const lines = item.text.split("\n").filter(Boolean);
                          return lines
                            .map(
                              (line: string) => `- ${line.replace("\n~ ", "")}`
                            )
                            .join("\n");
                        }
                        return item.text;
                      })
                      .join("\n");
                  }
                  return JSON.stringify(result, null, 2);
                })()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
