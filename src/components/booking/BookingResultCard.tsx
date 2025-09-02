"use client";

import {
  CheckCircle,
  XCircle,
  Warning,
  Stethoscope,
  User,
  ArrowSquareOut,
  Copy,
  Check,
  Calendar,
  Scissors,
} from "@phosphor-icons/react";
import { useState } from "react";

// Interface for createBooking/updateBooking results
export interface BookingResult {
  status: "success" | "error" | "warning";
  bookingId?: string;
  originalBookingId?: string; // Keep original for URL
  customer: string;
  customerId?: string | number;
  message: string;
  equipment?: string;
  surgeon?: string;
  salesRep?: string;
  surgeryDate?: string;
  surgeryType?: string;
  currency?: string;
  reservationType?: string;
  simulation?: string | boolean;
  availability?: string;
  items?: Array<{
    name?: string;
    quantity: number;
    materialId?: string;
    description?: string;
    availability?: string | boolean;
  }>;
  notes?: string;
  error?: string;
}

// Parser function to extract BookingResult from raw tool result
const parseBookingResult = (
  rawResult: any,
  requestArgs?: any
): BookingResult => {
  let bookingResultData: any = {};

  if (rawResult && typeof rawResult === "object") {
    if ("content" in rawResult && Array.isArray(rawResult.content)) {
      const textContent = rawResult.content.find(
        (c: any) => c.type === "text"
      )?.text;
      if (textContent) {
        try {
          bookingResultData = JSON.parse(textContent);
        } catch {
          bookingResultData = rawResult;
        }
      }
    } else {
      bookingResultData = rawResult;
    }
  }

  // Extract booking data from nested structure
  const booking = bookingResultData.booking || bookingResultData;

  // Extract request body data for enriching display
  const originalArgs = rawResult?._originalArgs || requestArgs || {};
  const requestBody = originalArgs;

  // Transform to BookingResult format
  const status: "success" | "error" | "warning" =
    bookingResultData.success !== false ? "success" : "error";

  // Extract customer name - prioritize request args, then booking data
  let customerName = "";
  let customerId = undefined;

  if (
    requestBody.customerName &&
    typeof requestBody.customerName === "string" &&
    requestBody.customerName.trim() !== ""
  ) {
    customerName = requestBody.customerName.trim();
    customerId = requestBody.customerId || requestBody.customer;
  } else if (booking.customerName && booking.customerName.trim() !== "") {
    customerName = booking.customerName.trim();
  } else {
    customerName = `Customer ${booking.customer || requestBody.customer}`;
  }

  // Extract booking ID from multiple possible locations
  let bookingId = undefined;
  let originalBookingId = undefined;

  // Helper function to check if booking ID is valid (has non-zero digits)
  const isValidBookingId = (id: string) => {
    if (!id || typeof id !== "string") return false;
    const trimmed = id.trim().replace(/^0+/, "");
    return trimmed.length > 0;
  };

  // Try different possible locations for booking ID
  const candidates = [
    booking.bookingId,
    booking.ID,
    booking.id,
    bookingResultData.bookingId,
    bookingResultData.ID,
    bookingResultData.id,
  ];

  console.log("🔍 All booking ID candidates:", candidates);

  for (const candidate of candidates) {
    if (candidate && isValidBookingId(candidate)) {
      originalBookingId = candidate.trim(); // Keep original for URL
      bookingId = originalBookingId.replace(/^0+/, ""); // Remove leading zeros for display
      console.log(
        "✅ Found valid booking ID:",
        bookingId,
        "(original:",
        originalBookingId,
        ")"
      );
      break;
    }
  }

  console.log("📋 Final extracted booking ID:", bookingId);

  // Debug availability for items from both sources
  if (booking.items?.length > 0) {
    console.log("🔍 Booking items availability status:");
    booking.items.forEach((item: any, index: number) => {
      console.log(
        `  Item ${index + 1}: ${item.description || item.materialId} - isAvailable: ${item.isAvailable} (type: ${typeof item.isAvailable})`
      );
    });
  }

  if (requestBody.items?.length > 0) {
    console.log("🔍 Request items availability status:");
    requestBody.items.forEach((item: any, index: number) => {
      console.log(
        `  Item ${index + 1}: ${item.name || item.materialId} - availability: ${item.availability} (type: ${typeof item.availability})`
      );
    });
  }

  return {
    status,
    bookingId: bookingId,
    originalBookingId: originalBookingId, // Keep original for URL
    customer: customerName,
    customerId: customerId,
    message: bookingResultData.success
      ? `Booking created successfully${bookingId ? ` (ID: ${bookingId})` : ""}`
      : "Failed to create booking",
    equipment:
      requestBody.equipmentDescription ||
      requestBody.description ||
      booking.equipmentDescription ||
      "Medical Equipment",
    surgeon:
      requestBody.surgeryDescription ||
      booking.surgeryDescription ||
      booking.surgeon ||
      "No specific surgeon",
    salesRep:
      requestBody.salesrep ||
      // Extract sales rep from notes format: "Equipment - Surgeon - SalesRep"
      (() => {
        const noteContent =
          requestBody.notes?.[0]?.noteContent ||
          booking.notes?.[0]?.noteContent;
        if (noteContent && typeof noteContent === "string") {
          const parts = noteContent.split(" - ");
          if (parts.length >= 3) {
            return parts[2].trim(); // Third part is sales rep
          }
        }
        return "Not specified";
      })(),
    surgeryDate: requestBody.dayOfUse
      ? new Date(requestBody.dayOfUse).toLocaleDateString()
      : booking.dayOfUse
        ? new Date(booking.dayOfUse).toLocaleDateString()
        : undefined,
    surgeryType: requestBody.surgeryType || booking.surgeryType,
    currency: requestBody.currency || booking.currency,
    reservationType: requestBody.reservationType || booking.reservationType,
    simulation:
      requestBody.isSimulation !== undefined
        ? requestBody.isSimulation
        : booking.isSimulation,
    items:
      booking.items?.map((item: any) => ({
        name: item.description || item.materialId,
        materialId: item.materialId,
        quantity: Number.parseInt(item.quantity) || 1,
        availability: item.isAvailable, // Use isAvailable from booking response
      })) ||
      requestBody.items?.map((item: any) => ({
        name: item.description || item.materialId,
        materialId: item.materialId,
        quantity: Number.parseInt(item.quantity) || 1,
        availability: item.availability || item.isAvailable,
      })) ||
      [],
    notes:
      requestBody.notes?.[0]?.noteContent || booking.notes?.[0]?.noteContent,
    error:
      bookingResultData.success === false
        ? bookingResultData.error || "Unknown error"
        : undefined,
  };
};

// Component that accepts either parsed or raw data
export const BookingOperationResultCard = ({
  data,
  rawResult,
  requestArgs,
}: {
  data?: BookingResult;
  rawResult?: any;
  requestArgs?: any;
}) => {
  const [copied, setCopied] = useState(false);

  // Parse raw result if provided, otherwise use parsed data
  const bookingResult = rawResult
    ? parseBookingResult(rawResult, requestArgs)
    : data;

  if (!bookingResult) {
    return (
      <div className="my-4 p-6 bg-gray-50 rounded-xl border border-gray-200 text-center">
        <p className="text-gray-500">No booking result data available</p>
      </div>
    );
  }

  // Handler for copying booking ID
  const handleCopyBookingId = async () => {
    if (bookingResult.bookingId) {
      try {
        await navigator.clipboard.writeText(bookingResult.bookingId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy booking ID:", err);
      }
    }
  };

  // Handler for opening booking URL
  const handleOpenBooking = () => {
    const idForUrl = bookingResult.originalBookingId || bookingResult.bookingId;
    if (idForUrl) {
      const baseUrl =
        "https://mymediset-xba-dev-eu10.launchpad.cfapps.eu10.hana.ondemand.com/site/mymediset#cloudmymedisetuibookings-manage?sap-ui-app-id-hint=mym_cloud_cloud.mymediset.uibookings&/Bookings";
      // Remove leading zeros from the ID
      const cleanedId = idForUrl.replace(/^0+/, "");
      const bookingUrl = `${baseUrl}('${cleanedId}')`;
      console.log("🔗 Opening booking URL with ID:", cleanedId);
      window.open(bookingUrl, "_blank");
    }
  };

  const getStatusConfig = () => {
    // Check if simulation is true to show "CHECK" status
    if (
      bookingResult.simulation === true ||
      bookingResult.simulation === "true"
    ) {
      return {
        icon: <Warning className="w-4 h-4" />,
        textColor: "text-yellow-700",
        bgColor: "bg-yellow-50",
        status: "CHECK",
      };
    }

    switch (bookingResult.status) {
      case "success":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          textColor: "text-green-700",
          bgColor: "bg-green-50",
          status: "SUCCESS",
        };
      case "error":
        return {
          icon: <XCircle className="w-4 h-4" />,
          textColor: "text-red-700",
          bgColor: "bg-red-50",
          status: "FAILED",
        };
      case "warning":
        return {
          icon: <Warning className="w-4 h-4" />,
          textColor: "text-yellow-700",
          bgColor: "bg-yellow-50",
          status: "WARNING",
        };
      default:
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          textColor: "text-green-700",
          bgColor: "bg-green-50",
          status: "SUCCESS",
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="my-4">
      <div className="bg-white border border-gray-200 overflow-hidden rounded-lg">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${statusConfig.bgColor}`}
                >
                  <div className={statusConfig.textColor}>
                    {statusConfig.icon}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium uppercase tracking-wider px-2 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}
                >
                  {statusConfig.status}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {bookingResult.customer}
                {bookingResult.customerId && ` (${bookingResult.customerId})`}
              </h3>

              {bookingResult.equipment && (
                <p className="text-sm text-gray-600">
                  {bookingResult.equipment}
                </p>
              )}
            </div>

            {bookingResult.bookingId && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    Booking ID
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-medium text-gray-900">
                      {bookingResult.bookingId}
                    </span>
                    <button
                      onClick={handleCopyBookingId}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy booking ID"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleOpenBooking}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Open booking"
                >
                  <ArrowSquareOut size={20} />
                </button>
              </div>
            )}
          </div>
        </div>

        {bookingResult.error && bookingResult.status === "error" && (
          <div className="mx-4 mt-3 p-3 border-l-2 border-gray-300 bg-gray-50">
            <p className="text-sm text-gray-700">{bookingResult.error}</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Stethoscope className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Surgeon
                </p>
                <p className="text-sm text-gray-900">
                  {bookingResult.surgeon || "No specific surgeon"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sales Rep
                </p>
                <p className="text-sm text-gray-900">
                  {bookingResult.salesRep || "Not specified"}
                </p>
              </div>
            </div>
          </div>

          {(bookingResult.surgeryDate || bookingResult.surgeryType) && (
            <div className="grid md:grid-cols-2 gap-4">
              {bookingResult.surgeryDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Surgery Date
                    </p>
                    <p className="text-sm text-gray-900">
                      {bookingResult.surgeryDate}
                    </p>
                  </div>
                </div>
              )}

              {bookingResult.surgeryType && (
                <div className="flex items-center gap-3">
                  <Scissors className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Surgery Type
                    </p>
                    <p className="text-sm text-gray-900">
                      {bookingResult.surgeryType}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Items ({bookingResult.items?.length || 0})
            </h4>
            {bookingResult.items && bookingResult.items.length > 0 ? (
              <div className="space-y-2">
                {bookingResult.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm text-gray-900 font-medium">
                        {item.name || item.materialId || "Unknown Item"}
                      </p>
                      {item.materialId && item.materialId !== item.name && (
                        <p className="text-xs text-gray-500 font-mono">
                          {item.materialId}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${(() => {
                        console.log(
                          `🎨 Item ${item.name || item.materialId} availability:`,
                          item.availability,
                          typeof item.availability
                        );
                        if (item.availability === true) {
                          console.log("  → Applying GREEN text");
                          return "text-green-600";
                        } else if (item.availability === false) {
                          console.log("  → Applying RED text");
                          return "text-red-600";
                        } else {
                          console.log("  → Applying GRAY text (default)");
                          return "text-gray-600";
                        }
                      })()}`}
                    >
                      Qty: {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">
                No items specified
              </p>
            )}
          </div>

          {(bookingResult.currency ||
            bookingResult.reservationType ||
            bookingResult.simulation !== undefined) && (
            <div className="border-t border-gray-100 pt-3">
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                {bookingResult.currency && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Currency
                    </p>
                    <p className="text-gray-900 font-medium">
                      {bookingResult.currency}
                    </p>
                  </div>
                )}
                {bookingResult.reservationType && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Reservation
                    </p>
                    <p className="text-gray-900 font-medium">
                      {bookingResult.reservationType}
                    </p>
                  </div>
                )}
                {bookingResult.simulation !== undefined && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Simulation
                    </p>
                    <p className="text-gray-900 font-medium">
                      {typeof bookingResult.simulation === "boolean"
                        ? bookingResult.simulation
                          ? "Yes"
                          : "No"
                        : bookingResult.simulation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {bookingResult.notes && (
            <div className="border-t border-gray-100 pt-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Notes
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {bookingResult.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
