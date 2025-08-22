import { CheckCircle, XCircle, Calendar, Clock } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export interface BookingResultInfo {
  status: "success" | "error" | "warning";
  bookingId?: string;
  customer?: string;
  customerId?: string;
  message: string;
  surgeryDate?: string;
  surgeryTime?: string;
  availability?: string;
  notes?: string;
  equipment?: string;
  surgeon?: string;
  salesRep?: string;
  currency?: string;
  reservationType?: string;
  surgeryType?: string;
  simulation?: string;
  items?: Array<{
    name: string;
    quantity: number;
    materialId?: string;
  }>;
}

// Typing animation CSS class (reusing from ChatBookingCard)
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

export const BookingResultCard = ({
  result,
}: {
  result: BookingResultInfo;
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

  // Sequential animation for result card fields
  useEffect(() => {
    if (animationStage < 4) {
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
  }, [animationStage]);

  // Status icon and colors
  const getStatusConfig = () => {
    switch (result.status) {
      case "success":
        return {
          icon: <CheckCircle size={20} />,
          iconColor: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
          titleColor: "text-green-800 dark:text-green-200",
        };
      case "error":
        return {
          icon: <XCircle size={20} />,
          iconColor: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-900/20",
          borderColor: "border-red-200 dark:border-red-800",
          titleColor: "text-red-800 dark:text-red-200",
        };
      default:
        return {
          icon: <Clock size={20} />,
          iconColor: "text-yellow-600 dark:text-yellow-400",
          bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
          borderColor: "border-yellow-200 dark:border-yellow-800",
          titleColor: "text-yellow-800 dark:text-yellow-200",
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div
      className={`${statusConfig.bgColor} rounded-md border ${statusConfig.borderColor} shadow-sm my-2`}
    >
      <div className="p-4">
        {/* Header with status icon and message */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`${statusConfig.iconColor} fade-in mt-0.5`}>
            {statusConfig.icon}
          </div>
          <div className="flex-1">
            <h3
              className={`font-semibold text-sm ${statusConfig.titleColor} fade-in ${animationStage >= 1 ? "typing-animation" : "opacity-0"}`}
            >
              {result.message}
              {animationStage === 1 && showTypingCursor && (
                <span className="typing-cursor">&nbsp;</span>
              )}
            </h3>
          </div>
        </div>

        {/* Booking details */}
        <div className="space-y-3 text-sm">
          {/* Booking ID */}
          {result.bookingId && (
            <div
              className={`flex items-center gap-2 fade-in ${animationStage >= 2 ? "" : "opacity-0"} delay-200`}
            >
              <Calendar size={16} className="text-[rgb(0,104,120)]" />
              <span className="font-medium">Booking ID:</span>
              <span className="font-mono text-[rgb(0,104,120)]">
                {result.bookingId}
                {animationStage === 2 && showTypingCursor && (
                  <span className="typing-cursor">&nbsp;</span>
                )}
              </span>
            </div>
          )}

          {/* Customer Information */}
          {result.customer && (
            <div className="grid grid-cols-1 gap-1 fade-in delay-300">
              <div className="flex items-center gap-2">
                <span className="font-medium">Customer:</span>
                <span>{result.customer}</span>
              </div>
              {result.customerId && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Customer ID:</span>
                  <span>{result.customerId}</span>
                </div>
              )}
            </div>
          )}

          {/* Equipment and Personnel */}
          <div className="grid grid-cols-1 gap-1 fade-in delay-400">
            {result.equipment && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Equipment:</span>
                <span>{result.equipment}</span>
              </div>
            )}
            {result.surgeon && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Surgeon:</span>
                <span>{result.surgeon}</span>
              </div>
            )}
            {result.salesRep && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Sales Representative:</span>
                <span>{result.salesRep}</span>
              </div>
            )}
          </div>

          {/* Surgery Details */}
          <div className="grid grid-cols-1 gap-1 fade-in delay-500">
            {result.surgeryDate && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Surgery Date:</span>
                <span>
                  {result.surgeryDate}
                  {result.surgeryTime && ` at ${result.surgeryTime}`}
                </span>
              </div>
            )}
            {result.surgeryType && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Surgery Type:</span>
                <span>{result.surgeryType}</span>
              </div>
            )}
          </div>

          {/* Items List */}
          {result.items && result.items.length > 0 && (
            <div className="fade-in delay-600">
              <span className="font-medium block mb-2">Items:</span>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 space-y-1">
                {result.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="flex-1">{item.name}</span>
                    <span className="text-neutral-600 dark:text-neutral-400 ml-2">
                      (Quantity: {item.quantity})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operational Details */}
          <div className="grid grid-cols-2 gap-4 text-xs fade-in delay-700">
            {result.currency && (
              <div>
                <span className="font-medium">Currency:</span>
                <span className="ml-1">{result.currency}</span>
              </div>
            )}
            {result.reservationType && (
              <div>
                <span className="font-medium">Reservation Type:</span>
                <span className="ml-1">{result.reservationType}</span>
              </div>
            )}
            {result.simulation && (
              <div>
                <span className="font-medium">Simulation:</span>
                <span className="ml-1">{result.simulation}</span>
              </div>
            )}
          </div>

          {/* Availability Status */}
          {result.availability && (
            <div className="flex items-center gap-2 fade-in delay-800">
              <span className="font-medium">Availability:</span>
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  result.availability.toLowerCase().includes("available") &&
                  !result.availability.toLowerCase().includes("not")
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {result.availability}
              </span>
            </div>
          )}

          {/* Notes */}
          {result.notes && (
            <div className="mt-3 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs fade-in delay-900">
              <span className="font-medium">Notes: </span>
              {result.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Parsing function to extract booking result info from markdown text
export const parseBookingResultInfo = (text: string): BookingResultInfo[] => {
  console.log("🔍 parseBookingResultInfo called with text:", text);
  
  const results: BookingResultInfo[] = [];

  // Pattern for complete booking-result blocks
  const completeResultPattern = /```booking-result\s+([\s\S]*?)```/g;
  // Pattern for incomplete booking-result blocks
  const incompleteResultPattern = /```booking-result\s+([\s\S]*?)$/;

  // Check for complete results
  let match;
  let matchCount = 0;
  while ((match = completeResultPattern.exec(text)) !== null) {
    matchCount++;
    console.log(`📋 Found complete booking-result block #${matchCount}:`, match[1]);
    const resultContent = match[1];
    const result = extractBookingResultDetails(resultContent);
    console.log("✅ Parsed result:", result);
    results.push(result);
  }

  // Check for incomplete result at the end of text (only if no complete blocks were found)
  if (matchCount === 0) {
    const incompleteMatch = text.match(incompleteResultPattern);
    if (incompleteMatch && !text.endsWith("```")) {
      console.log("⚠️ Found incomplete booking-result block:", incompleteMatch[1]);
      const incompleteContent = incompleteMatch[1];
      const result = extractBookingResultDetails(incompleteContent);
      console.log("✅ Parsed incomplete result:", result);
      results.push(result);
    }
  }

  console.log(`🎯 Total booking results found: ${results.length}`, results);
  return results;
};

// Helper function to extract booking result details from content
const extractBookingResultDetails = (content: string): BookingResultInfo => {
  const lines = content.trim().split("\n");

  const result: BookingResultInfo = {
    status: "success",
    message: "Operation completed",
    items: [],
  };

  let isInItemsSection = false;
  
  lines.forEach((line) => {
    const cleanLine = line.trim();
    
    if (cleanLine.startsWith("status:")) {
      const status = cleanLine.slice(7).trim() as "success" | "error" | "warning";
      result.status = status;
    } else if (cleanLine.startsWith("bookingId:")) {
      result.bookingId = cleanLine.slice(10).trim();
    } else if (cleanLine.startsWith("customer:")) {
      result.customer = cleanLine.slice(9).trim();
    } else if (cleanLine.startsWith("customerId:")) {
      result.customerId = cleanLine.slice(11).trim();
    } else if (cleanLine.startsWith("message:")) {
      result.message = cleanLine.slice(8).trim();
    } else if (cleanLine.startsWith("surgeryDate:")) {
      result.surgeryDate = cleanLine.slice(12).trim();
    } else if (cleanLine.startsWith("surgeryTime:")) {
      result.surgeryTime = cleanLine.slice(12).trim();
    } else if (cleanLine.startsWith("availability:")) {
      result.availability = cleanLine.slice(13).trim();
    } else if (cleanLine.startsWith("notes:")) {
      result.notes = cleanLine.slice(6).trim();
    } else if (cleanLine.startsWith("equipment:")) {
      result.equipment = cleanLine.slice(10).trim();
    } else if (cleanLine.startsWith("surgeon:")) {
      result.surgeon = cleanLine.slice(8).trim();
    } else if (cleanLine.startsWith("salesRep:")) {
      result.salesRep = cleanLine.slice(9).trim();
    } else if (cleanLine.startsWith("currency:")) {
      result.currency = cleanLine.slice(9).trim();
    } else if (cleanLine.startsWith("reservationType:")) {
      result.reservationType = cleanLine.slice(16).trim();
    } else if (cleanLine.startsWith("surgeryType:")) {
      result.surgeryType = cleanLine.slice(12).trim();
    } else if (cleanLine.startsWith("simulation:")) {
      result.simulation = cleanLine.slice(11).trim();
    } else if (cleanLine.toLowerCase() === "items:") {
      isInItemsSection = true;
    } else if (isInItemsSection && cleanLine.includes("(Quantity:")) {
      // Parse item line like "CRANIAL KIT W/ DRILL SPLINT MODEL (Quantity: 1)"
      const match = cleanLine.match(/^(.+?)\s*\(Quantity:\s*(\d+)\)$/);
      if (match) {
        result.items!.push({
          name: match[1].trim(),
          quantity: parseInt(match[2]),
        });
      }
    } else if (isInItemsSection && cleanLine && !cleanLine.includes(":")) {
      // Stop items section when we hit a non-item line
      isInItemsSection = false;
    }
  });

  return result;
};

// Function to detect if text contains booking-result markdown
export const hasBookingResultMarkdown = (text: string): boolean => {
  const resultPattern = /```booking-result\s+/;
  return resultPattern.test(text);
};

// Function to remove booking-result markdown from text
export const removeBookingResultsFromText = (text: string): string => {
  // Remove complete booking-result blocks
  let cleaned = text.replace(/```booking-result\s+([\s\S]*?)```/g, "");

  // Remove incomplete booking-result block at the end
  cleaned = cleaned.replace(/```booking-result\s+([\s\S]*?)$/, "");

  return cleaned;
};
