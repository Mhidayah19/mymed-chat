import { useState } from "react";
import { Robot, CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Tooltip } from "@/components/tooltip/Tooltip";
import { APPROVAL } from "@/shared";
import { TemplatesCard } from "../TemplatesCard";
import type { BookingTemplate } from "../../types";
import type { 
  BookingTemplateItem,
  TransformedTemplate,
  TransformedTemplatesData,
  ContentResult,
  ToolInvocationResult,
  BookingTemplatesResult
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

  // Clean up MCP tool names by removing the prefix (e.g., "0TtDG-wD_getConsumptionRequests" -> "getConsumptionRequests")
  const cleanToolName = (toolName: string) => {
    const match = toolName.match(/^[A-Za-z0-9\-]+_(.+)$/);
    return match ? match[1] : toolName;
  };

  // Check if this is a template-related tool and render the specialized component
  const cleanedToolName = cleanToolName(toolInvocation.toolName);
  if ((cleanedToolName === "getCachedTemplates" || cleanedToolName === "getRecommendedBooking") && toolInvocation.state === "result") {
    const result = toolInvocation.result as ToolInvocationResult;
    
    // Parse the result to extract structured data
    let templatesData: any;
    console.log(`Raw result from ${cleanedToolName}:`, JSON.stringify(result, null, 2));
    
    // Handle getRecommendedBooking - pass data directly to TemplatesCard
    if (cleanedToolName === "getRecommendedBooking") {
      templatesData = result;
    }
    // Handle getCachedTemplates - transform to expected format
    else if (result && typeof result === 'object') {
      const isBookingResult = (r: ToolInvocationResult): r is BookingTemplatesResult => 
        'success' in r && 'templates' in r;

      if (isBookingResult(result) && result.success) {
        // Transform the data to match TemplatesCard's expected format
        const transformedTemplates = result.templates?.map((template: BookingTemplate): TransformedTemplate => ({
          customer: template.customer || template.customerId || 'Unknown Customer',
          customerId: template.customerId || '',
          surgeon: template.surgeon || 'Unknown Surgeon',
          salesRep: template.salesrep || 'Unknown Sales Rep',
          frequency: template.frequency || 0,
          totalBookings: template.totalBookings || 0,
          equipment: template.equipment || template.items?.[0]?.materialId || 'No specific equipment',
          items: template.items?.map((item: BookingTemplateItem) => ({
            materialId: item.materialId,
            name: item.name || item.materialId,
            quantity: item.quantity || 1,
            description: item.description,
            availability: item.availability
          })) || [],
          reservationType: template.reservationType || '01',
          confidence: template.confidence,
          insights: template.insights
        })) || [];

        templatesData = {
          type: 'templates',
          templates: transformedTemplates,
          count: transformedTemplates.length,
          status: result.success ? 'success' : 'error'
        };
      } else if ('content' in result && result.content && Array.isArray(result.content)) {
        // Try to parse from content array
        const textContent = result.content.find((c) => c.type === 'text')?.text;
        if (textContent) {
          try {
            const parsed = JSON.parse(textContent) as ToolInvocationResult;
            if (isBookingResult(parsed) && parsed.success) {
              const transformedTemplates = parsed.templates?.map((template: BookingTemplate): TransformedTemplate => ({
                customer: template.customer || template.customerId || 'Unknown Customer',
                customerId: template.customerId || '',
                surgeon: template.surgeon || 'Unknown Surgeon',
                salesRep: template.salesrep || 'Unknown Sales Rep',
                frequency: template.frequency || 0,
                totalBookings: template.totalBookings || 0,
                equipment: template.equipment || template.items?.[0]?.materialId || 'No specific equipment',
                items: template.items?.map((item: BookingTemplateItem) => ({
                  materialId: item.materialId,
                  name: item.name || item.materialId,
                  quantity: item.quantity || 1,
                  description: item.description,
                  availability: item.availability
                })) || [],
                reservationType: template.reservationType || '01',
                confidence: template.confidence,
                insights: template.insights
              })) || [];

              templatesData = {
                type: 'templates',
                templates: transformedTemplates,
                count: transformedTemplates.length,
                status: parsed.success ? 'success' : 'error'
              };
            }
          } catch {
            // If parsing fails, create fallback structure
            templatesData = {
              type: 'templates',
              templates: [],
              count: 0,
              status: 'error'
            };
          }
        }
      }
    }
    
    // Render TemplatesCard if we have valid data
    console.log('Final templatesData for TemplatesCard:', JSON.stringify(templatesData, null, 2));
    if (templatesData) {
      return (
        <div className="w-full">
          <TemplatesCard data={templatesData} />
          {/* This component IS the complete response - no additional text needed */}
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
