import { useState } from "react";
import { Robot, CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Tooltip } from "@/components/tooltip/Tooltip";
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
    <Card
      className={`p-4 my-3 w-full rounded-md ${
        needsConfirmation
          ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
          : "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800"
      } overflow-hidden shadow-sm`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <div
          className={`${
            needsConfirmation
              ? "bg-yellow-500/10 dark:bg-yellow-400/10"
              : "bg-blue-500/10 dark:bg-blue-400/10"
          } p-1.5 rounded-full flex-shrink-0`}
        >
          <Robot
            size={16}
            className={`${
              needsConfirmation
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-blue-600 dark:text-blue-400"
            }`}
          />
        </div>
        <h4 className="font-medium flex items-center gap-2 flex-1 text-left">
          {cleanToolName(toolInvocation.toolName)}
          {!needsConfirmation && toolInvocation.state === "result" && (
            <span className="text-xs text-green-600 dark:text-green-400">
              ✓ Completed
            </span>
          )}
        </h4>
        <CaretDown
          size={16}
          className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`transition-all duration-200 ${isExpanded ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div
          className="overflow-y-auto"
          style={{ maxHeight: isExpanded ? "180px" : "0px" }}
        >
          <div className="mb-3">
            <h5 className="text-xs font-medium mb-1 text-muted-foreground">
              Arguments:
            </h5>
            <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
              {JSON.stringify(toolInvocation.args, null, 2)}
            </pre>
          </div>

          {needsConfirmation && toolInvocation.state === "call" && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="primary"
                size="sm"
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
          )}

          {!needsConfirmation && toolInvocation.state === "result" && (
            <div className="mt-3 border-t border-[#2F366D]/10 pt-3">
              <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                Result:
              </h5>
              <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
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
    </Card>
  );
}
