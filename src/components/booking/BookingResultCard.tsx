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
  isLoading?: boolean;
  items?: Array<{
    name: string;
    quantity: number;
    materialId?: string;
    availability?: string;
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

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .typing-cursor {
    border-right: 2px solid;
    animation: blink 1s step-end infinite;
  }

  .typing-animation {
    will-change: width;
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    animation: typing 1.5s steps(30, end);
  }

  .fade-in {
    will-change: opacity, transform;
    opacity: 0;
    animation: fadeIn 0.5s ease-out forwards;
  }

  .shimmer {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.6) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite linear;
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

  // Status icon and colors - MyMediset Design System
  const getStatusConfig = () => {
    switch (result.status) {
      case "success":
        return {
          icon: <CheckCircle size={20} />,
          iconColor: "text-[#10b981]", // Medical analytics performance green
          bgColor: "bg-white", // Clean white background
          borderColor: "border-[#10b981]/20",
          titleColor: "text-[#166534]", // Dark green for text
          shadowColor: "shadow-[0_4px_6px_-1px_rgba(16,185,129,0.1)]",
        };
      case "error":
        return {
          icon: <XCircle size={20} />,
          iconColor: "text-[#ef4444]", // Medical analytics critical red
          bgColor: "bg-gradient-to-br from-[#fef2f2] to-[#fee2e2]", // Light red gradient
          borderColor: "border-[#ef4444]/20",
          titleColor: "text-[#991b1b]", // Dark red for text
          shadowColor: "shadow-[0_4px_6px_-1px_rgba(239,68,68,0.1)]",
        };
      default:
        return {
          icon: <Clock size={20} />,
          iconColor: "text-[#f59e0b]", // Medical analytics warning amber
          bgColor: "bg-gradient-to-br from-[#fffbeb] to-[#fef3c7]", // Light amber gradient
          borderColor: "border-[#f59e0b]/20",
          titleColor: "text-[#92400e]", // Dark amber for text
          shadowColor: "shadow-[0_4px_6px_-1px_rgba(245,158,11,0.1)]",
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div 
      role="article"
      aria-label={`Booking ${result.bookingId || ''} - ${result.status} status`}
      className="my-4 rounded-[20px] p-0.5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus-within:scale-[1.02] focus-within:shadow-lg" 
      style={{background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%)'}}
      tabIndex={0}
    >
      <div
        className={`
          ${statusConfig.bgColor} 
          backdrop-blur-md backdrop-filter 
          rounded-[20px]
          ${statusConfig.shadowColor}
          overflow-hidden
        `}
      >
        <div className="p-6">
          {result.isLoading ? (
            <div className="space-y-4" aria-label="Loading booking details">
              <div className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-gray-200 shimmer"></div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-200 rounded w-3/4 shimmer"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-12 bg-gray-200 rounded shimmer"></div>
                <div className="h-24 bg-gray-200 rounded shimmer"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="h-16 bg-gray-200 rounded shimmer"></div>
                  <div className="h-16 bg-gray-200 rounded shimmer"></div>
                  <div className="h-16 bg-gray-200 rounded shimmer"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <header className="flex items-start gap-4">
                <div 
                  className={`${statusConfig.iconColor} fade-in mt-1`}
                  role="img"
                  aria-label={`${result.status} status`}
                >
                  {statusConfig.icon}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold text-base text-black dark:text-white fade-in ${animationStage >= 1 ? "typing-animation" : "opacity-0"}`}>
                    {result.message}
                    {animationStage === 1 && showTypingCursor && (
                      <span className="typing-cursor">&nbsp;</span>
                    )}
                  </h3>
                </div>
              </header>

              {/* Booking details */}
              <div className="space-y-4 text-sm">
                {/* Booking ID */}
                {result.bookingId && (
                  <div
                    className={`flex items-center gap-3 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 fade-in ${animationStage >= 2 ? "" : "opacity-0"} delay-200`}
                  >
                    <Calendar size={18} className="text-gray-700" />
                    <span className="font-medium text-black">Booking ID:</span>
                    <span className="font-mono text-gray-700 font-semibold">
                      {result.bookingId}
                      {animationStage === 2 && showTypingCursor && (
                        <span className="typing-cursor">&nbsp;</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Customer Information */}
                {result.customer && (
                  <div className="space-y-2 fade-in delay-300">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-black min-w-[120px]">
                        Customer:
                      </span>
                      <span className="text-gray-700 font-medium">
                        {result.customer}
                      </span>
                    </div>
                    {result.customerId && (
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-black min-w-[120px]">
                          Customer ID:
                        </span>
                        <span className="text-gray-600">{result.customerId}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Equipment and Personnel */}
                <div className="space-y-2 fade-in delay-400">
                  {result.equipment && (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-black min-w-[120px]">
                        Equipment:
                      </span>
                      <span className="text-gray-700">{result.equipment}</span>
                    </div>
                  )}
                  {result.surgeon && (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-black min-w-[120px]">
                        Surgeon:
                      </span>
                      <span className="text-gray-700">{result.surgeon}</span>
                    </div>
                  )}
                  {result.salesRep && (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-black min-w-[120px]">
                        Sales Rep:
                      </span>
                      <span className="text-gray-700">{result.salesRep}</span>
                    </div>
                  )}
                </div>

                {/* Surgery Details */}
                <div className="space-y-2 fade-in delay-500">
                  {result.surgeryDate && (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-black min-w-[120px]">
                        Surgery Date:
                      </span>
                      <span className="text-gray-700">
                        {result.surgeryDate}
                        {result.surgeryTime && ` at ${result.surgeryTime}`}
                      </span>
                    </div>
                  )}
                  {result.surgeryType && (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-black min-w-[120px]">
                        Surgery Type:
                      </span>
                      <span className="text-gray-700">{result.surgeryType}</span>
                    </div>
                  )}
                </div>

                {/* Items List */}
                {result.items && result.items.length > 0 && (
                  <div className="fade-in delay-600">
                    <h4 className="font-medium block mb-3 text-black">Items:</h4>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 space-y-3 border border-white/30 divide-y divide-gray-100">
                      {result.items.map((item, index) => (
                        <div
                          key={index}
                          className="py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex-1 flex items-center gap-3 flex-wrap">
                              <span className="text-gray-700 font-medium">
                                {item.name}
                              </span>
                              {item.availability && (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1
                                    ${item.availability.toLowerCase().includes("available") &&
                                    !item.availability.toLowerCase().includes("not")
                                      ? "bg-gradient-to-r from-[#10b981] to-[#16a34a] text-white"
                                      : "bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white"
                                    }`}
                                  role="status"
                                >
                                  {item.availability.toLowerCase().includes("available") ? 
                                    <CheckCircle size={12} weight="fill" /> : 
                                    <XCircle size={12} weight="fill" />
                                  }
                                  {item.availability}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Quantity:</span>
                              <span className="text-gray-700 font-semibold">{item.quantity}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operational Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 text-sm fade-in delay-700">
                  {result.currency && (
                    <div className="text-center p-3 bg-white/60 rounded-lg">
                      <span className="block text-gray-500 text-xs mb-1">
                        Currency
                      </span>
                      <span className="font-semibold text-black">
                        {result.currency}
                      </span>
                    </div>
                  )}
                  {result.reservationType && (
                    <div className="text-center p-3 bg-white/60 rounded-lg">
                      <span className="block text-gray-500 text-xs mb-1">
                        Reservation
                      </span>
                      <span className="font-semibold text-black">
                        {result.reservationType}
                      </span>
                    </div>
                  )}
                  {result.simulation && (
                    <div className="text-center p-3 bg-white/60 rounded-lg">
                      <span className="block text-gray-500 text-xs mb-1">
                        Simulation
                      </span>
                      <span className="font-semibold text-black">
                        {result.simulation}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {result.notes && (
                  <div className="p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 text-sm fade-in delay-900">
                    <span className="font-medium text-black block mb-2">Notes:</span>
                    <span className="text-gray-700 leading-relaxed">
                      {result.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};// Parsing function to extract booking result info from markdown text
export const parseBookingResultInfo = (text: string): BookingResultInfo[] => {
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
    const resultContent = match[1];
    const result = extractBookingResultDetails(resultContent);
    results.push(result);
  }

  // Check for incomplete result at the end of text (only if no complete blocks were found)
  if (matchCount === 0) {
    const incompleteMatch = text.match(incompleteResultPattern);
    if (incompleteMatch && !text.endsWith("```")) {
      const incompleteContent = incompleteMatch[1];
      const result = extractBookingResultDetails(incompleteContent);
      results.push(result);
    }
  }

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
      const status = cleanLine.slice(7).trim() as
        | "success"
        | "error"
        | "warning";
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
      // Parse item line like "CRANIAL KIT W/ DRILL SPLINT MODEL (Quantity: 1)" or "ItemName (Quantity: 1) - Not Available"
      const match = cleanLine.match(/^(.+?)\s*\(Quantity:\s*(\d+)\)(?:\s*-\s*(.+))?$/);
      if (match) {
        const itemName = match[1].trim();
        const quantity = parseInt(match[2]);
        const availability = match[3] ? match[3].trim() : undefined;
        
        result.items!.push({
          name: itemName,
          quantity: quantity,
          availability: availability,
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

