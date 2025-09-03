import { CheckCircle, Info, List, Calendar } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { JSX } from "react";

export interface GenericToolResult {
  tool: string;
  status?: "success" | "error" | "info";
  title?: string;
  [key: string]: any; // Allow any additional properties
}

// Typing animation CSS class (reusing from BookingResultCard)
export const typingAnimationClass = `
  @keyframes typing {
    from { width: 0 }
    to { width: 100% }
  }

  @keyframes blink {
    from, to { border-color: transparent }
    50% { border-color: currentColor }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .typing-cursor {
    border-right: 2px solid;
    animation: blink 1s step-end infinite;
  }

  .typing-animation {
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    animation: typing 1.5s steps(30, end);
  }

  .fade-in {
    opacity: 0;
    animation: fadeIn 0.5s ease-out forwards;
  }

  .delay-100 { animation-delay: 100ms; }
  .delay-200 { animation-delay: 200ms; }
  .delay-300 { animation-delay: 300ms; }
  .delay-400 { animation-delay: 400ms; }
  .delay-500 { animation-delay: 500ms; }
`;

export const GenericToolResultCard = ({
  result,
}: {
  result: GenericToolResult;
}) => {
  const [animationStage, setAnimationStage] = useState(0);
  const [showTypingCursor, setShowTypingCursor] = useState(true);

  // Add animation styles to head on mount
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.innerHTML = typingAnimationClass;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Get all fields to display (exclude tool, status, title)
  const getDisplayFields = () => {
    const { tool, status, title, ...fields } = result;
    return fields;
  };

  // Calculate total animation stages: 1 (title) + number of fields + 1 (status)
  const displayFields = getDisplayFields();
  const totalStages = 1 + Object.keys(displayFields).length + 1;

  // Sequential animation
  useEffect(() => {
    if (animationStage < totalStages) {
      const timer = setTimeout(() => {
        setAnimationStage((prev) => prev + 1);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setShowTypingCursor(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [animationStage, totalStages]);

  // Get tool icon and colors
  const getToolConfig = () => {
    const status = result.status || "info";

    switch (status) {
      case "success":
        return {
          icon: <CheckCircle size={20} />,
          iconColor: "text-[#10b981]",
          bgColor: "bg-white",
          borderColor: "border-[#10b981]/20",
          titleColor: "text-[#166534]",
          shadowColor: "shadow-[0_4px_6px_-1px_rgba(16,185,129,0.1)]",
        };
      case "error":
        return {
          icon: <CheckCircle size={20} />,
          iconColor: "text-[#ef4444]",
          bgColor: "bg-white",
          borderColor: "border-[#ef4444]/20",
          titleColor: "text-[#991b1b]",
          shadowColor: "shadow-[0_4px_6px_-1px_rgba(239,68,68,0.1)]",
        };
      default:
        return {
          icon: <Info size={20} />,
          iconColor: "text-[#00D4FF]",
          bgColor: "bg-white",
          borderColor: "border-[#00D4FF]/20",
          titleColor: "text-[#0891b2]",
          shadowColor: "shadow-[0_4px_6px_-1px_rgba(0,212,255,0.1)]",
        };
    }
  };

  const toolConfig = getToolConfig();

  // Generate display title
  const getDisplayTitle = () => {
    if (result.title) return result.title;

    // Convert tool name to readable format
    const toolName = result.tool || "Tool Result";
    return toolName
      .replace(/([A-Z])/g, " $1") // Add space before capitals
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
  };

  // Render any value dynamically (simplified for booking card style)
  const renderValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "N/A";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "string" || typeof value === "number") {
      return value.toString();
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "None";
      }
      
      // For simple arrays, join with commas
      if (value.every(item => typeof item === "string" || typeof item === "number")) {
        return value.join(", ");
      }
      
      // For complex arrays, show count
      return `${value.length} items`;
    }

    if (typeof value === "object") {
      // For objects, show a simple summary
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return "Empty";
      }
      
      // Try to find a meaningful display value
      if (value.title) {
        return value.title.toString();
      }
      if (value.name) {
        return value.name.toString();
      }
      if (value.id) {
        return value.id.toString();
      }
      
      return `${entries.length} properties`;
    }

    return JSON.stringify(value);
  };

  const hasFields = Object.keys(displayFields).length > 0;

  return (
    <div
      className="bg-white dark:bg-neutral-800 rounded-md border-2 border-neutral-300 dark:border-neutral-600 shadow-sm my-2 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="p-3">
        {/* Header with tool icon and title */}
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[rgb(0,104,120)] fade-in">
            {toolConfig.icon}
          </div>
          <span
            className={`font-medium text-sm fade-in ${animationStage >= 1 ? "typing-animation" : "opacity-0"}`}
          >
            {getDisplayTitle()}
            {animationStage === 1 && showTypingCursor && (
              <span className="typing-cursor">&nbsp;</span>
            )}
          </span>
          {result.status && animationStage >= totalStages && (
            <span
              className={`ml-auto text-xs px-2 py-0.5 rounded-full fade-in ${
                result.status === "success"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : result.status === "error"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}
              style={{ animationDelay: `${200 + Object.keys(displayFields).length * 100}ms` }}
            >
              {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
            </span>
          )}
        </div>

        {/* Dynamic content rendering */}
        {hasFields && (
          <div className="grid grid-cols-1 gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            {Object.entries(displayFields).map(([key, value], index) => (
              <div
                key={key}
                className={`flex items-center fade-in ${animationStage >= index + 2 ? "" : "opacity-0"}`}
                style={{ animationDelay: `${200 + index * 100}ms` }}
              >
                <span className="font-medium mr-2 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}:
                </span>
                <span>
                  {renderValue(value)}
                  {animationStage === index + 2 && showTypingCursor && (
                    <span className="typing-cursor">&nbsp;</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Fallback if no displayable fields */}
        {!hasFields && animationStage >= 2 && (
          <div className="text-xs text-neutral-600 dark:text-neutral-300 text-center fade-in delay-200">
            <span className="italic">
              Tool executed successfully
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Parsing function to extract tool result info from markdown text
export const parseToolResults = (text: string): GenericToolResult[] => {
  const results: GenericToolResult[] = [];

  // Pattern for complete tool-result blocks
  const completeResultPattern = /```tool-result\s+([\s\S]*?)```/g;
  // Pattern for incomplete tool-result blocks
  const incompleteResultPattern = /```tool-result\s+([\s\S]*?)$/;

  // Check for complete results
  let match;
  let matchCount = 0;
  while ((match = completeResultPattern.exec(text)) !== null) {
    matchCount++;
    const resultContent = match[1];
    const result = extractToolResultDetails(resultContent);
    results.push(result);
  }

  // Check for incomplete result at the end of text (only if no complete blocks were found)
  if (matchCount === 0) {
    const incompleteMatch = text.match(incompleteResultPattern);
    if (incompleteMatch && !text.endsWith("```")) {
      const incompleteContent = incompleteMatch[1];
      const result = extractToolResultDetails(incompleteContent);
      results.push(result);
    }
  }

  return results;
};

// Helper function to extract tool result details from content
const extractToolResultDetails = (content: string): GenericToolResult => {
  const lines = content.trim().split("\n");

  const result: GenericToolResult = {
    tool: "Unknown Tool",
    status: "info",
  };

  let currentKey = "";
  let currentValue = "";
  let isMultiLine = false;

  lines.forEach((line) => {
    const cleanLine = line.trim();

    if (cleanLine.includes(":") && !isMultiLine) {
      // Save previous key-value if exists
      if (currentKey && currentValue) {
        result[currentKey] = parseValue(currentValue.trim());
      }

      // Parse new key-value
      const colonIndex = cleanLine.indexOf(":");
      currentKey = cleanLine.slice(0, colonIndex).trim();
      currentValue = cleanLine.slice(colonIndex + 1).trim();

      // Check if this might be a multi-line value (array or object)
      isMultiLine =
        currentValue === "" ||
        currentValue.startsWith("[") ||
        currentValue.startsWith("-");
    } else if (isMultiLine) {
      // Continue building multi-line value
      currentValue += "\n" + cleanLine;
    } else if (currentKey) {
      // Continue single-line value
      currentValue += " " + cleanLine;
    }
  });

  // Save final key-value
  if (currentKey && currentValue) {
    result[currentKey] = parseValue(currentValue.trim());
  }

  return result;
};

// Helper function to parse different value types
const parseValue = (value: string): any => {
  console.log("🔍 Parsing value:", value);

  // Try to parse as JSON
  try {
    return JSON.parse(value);
  } catch {
    // Not JSON, handle special formats
  }

  // Handle complex template format (detecting hospital names vs details)
  if (value.includes("\n-") && value.includes(":")) {
    const lines = value.split("\n").filter((line) => line.trim());
    const templates: any[] = [];
    let currentTemplate: any = {};

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();

      if (trimmedLine.startsWith("- ") && trimmedLine.includes(":")) {
        const content = trimmedLine.slice(2).trim();

        // Check if this looks like a hospital/main template entry
        // Look for patterns like "HOSPITAL NAME: TEMPLATE_NAME" or just "HOSPITAL NAME"
        const isMainTemplate =
          content.toUpperCase().includes("HOSPITAL") ||
          content.toUpperCase().includes("CLINIC") ||
          content.toUpperCase().includes("MEDICAL") ||
          // Check if it's an all-caps institutional name (like "ROYAL PRINCE ALFRED HOSPITAL")
          (content.split(":")[0].trim().toUpperCase() ===
            content.split(":")[0].trim() &&
            content.split(":")[0].trim().split(" ").length >= 2);

        if (isMainTemplate) {
          // Save previous template if exists
          if (Object.keys(currentTemplate).length > 0) {
            templates.push(currentTemplate);
          }

          // Start new template
          currentTemplate = {};
          if (content.includes(":")) {
            const [key, ...valueParts] = content.split(":");
            currentTemplate.title = key.trim();
            if (valueParts.length > 0 && valueParts.join(":").trim()) {
              currentTemplate.template = valueParts.join(":").trim();
            }
          } else {
            currentTemplate.title = content;
          }
        } else {
          // This is a detail line for the current template
          const [key, ...valueParts] = content.split(":");
          if (key && valueParts.length > 0) {
            const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "");
            currentTemplate[cleanKey] = valueParts.join(":").trim();
          }
        }
      }
    }

    // Add the last template
    if (Object.keys(currentTemplate).length > 0) {
      templates.push(currentTemplate);
    }

    console.log("🎯 Parsed templates:", templates);
    return templates.length > 0
      ? templates
      : value
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("-"))
          .map((line) => line.slice(1).trim());
  }

  // Handle simple arrays in YAML-like format
  if (value.includes("\n-")) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("-"))
      .map((line) => line.slice(1).trim());
  }

  // Handle boolean-like strings
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;

  // Handle numbers
  if (!isNaN(Number(value)) && value !== "") {
    return Number(value);
  }

  // Return as string
  return value;
};

// Function to detect if text contains tool-result markdown
export const hasToolResultMarkdown = (text: string): boolean => {
  const resultPattern = /```tool-result\s+/;
  return resultPattern.test(text);
};

// Function to remove tool-result markdown from text
export const removeToolResultsFromText = (text: string): string => {
  // Remove complete tool-result blocks
  let cleaned = text.replace(/```tool-result\s+([\s\S]*?)```/g, "");

  // Remove incomplete tool-result block at the end
  cleaned = cleaned.replace(/```tool-result\s+([\s\S]*?)$/, "");

  return cleaned;
};
