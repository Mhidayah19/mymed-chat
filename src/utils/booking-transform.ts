/**
 * Booking data transformation utilities to eliminate duplication
 */

import { BOOKING_DEFAULTS } from "../constants";
import type { BookingData } from "../types";
import { safeGet, safeGetNested } from "./error-handling";
import { getCurrentTimestamp } from "./time";

/**
 * Transform raw MCP booking data to standardized BookingData format (pure function)
 * Centralizes all the transformation logic that was duplicated
 */
export function transformBookingData(rawBooking: any): BookingData {
  // Extract equipment from items array safely
  const equipment =
    safeGetNested(rawBooking, ["items", "0", "materialId"], null) ||
    safeGetNested(
      rawBooking,
      ["items", "0", "description"],
      BOOKING_DEFAULTS.EQUIPMENT
    );

  // Extract other fields with safe defaults
  const customer =
    safeGet(rawBooking, "customerName", null) ||
    safeGet(rawBooking, "customer", BOOKING_DEFAULTS.CUSTOMER);

  const customerId = safeGet(rawBooking, "customer", BOOKING_DEFAULTS.ID);

  const surgeon = safeGet(rawBooking, "surgeon", BOOKING_DEFAULTS.SURGEON);

  const salesrep =
    safeGet(rawBooking, "salesRepName", null) ||
    safeGet(rawBooking, "salesrep", BOOKING_DEFAULTS.SALES_REP);

  const id =
    safeGet(rawBooking, "bookingId", null) ||
    safeGet(rawBooking, "id", BOOKING_DEFAULTS.ID);

  const date =
    safeGet(rawBooking, "dayOfUse", null) ||
    safeGet(rawBooking, "createdOn", null) ||
    safeGet(rawBooking, "deliveryDate", getCurrentTimestamp());

  const status =
    safeGet(rawBooking, "bookingStatus", null) ||
    safeGet(rawBooking, "status", BOOKING_DEFAULTS.STATUS);

  const value = parseFloat(
    safeGet(rawBooking, "estimatedValue", null) ||
      safeGet(rawBooking, "value", "0")
  );

  return Object.freeze({
    id,
    customer,
    customerId,
    surgeon,
    salesrep,
    equipment,
    date,
    status,
    value,
  });
}

/**
 * Transform an array of raw bookings to BookingData array (pure function)
 */
export function transformBookingArray(
  rawBookings: readonly any[]
): BookingData[] {
  return rawBookings.map(transformBookingData);
}

/**
 * Validate booking data structure
 */
export function isValidBookingData(data: any): data is BookingData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.id === "string" &&
    typeof data.customer === "string" &&
    typeof data.customerId === "string" &&
    typeof data.surgeon === "string" &&
    typeof data.salesrep === "string" &&
    typeof data.equipment === "string" &&
    typeof data.date === "string" &&
    typeof data.status === "string" &&
    typeof data.value === "number"
  );
}

/**
 * Create booking combination key for frequency analysis
 */
export function createCombinationKey(
  equipment: string,
  surgeon: string,
  salesrep: string
): string {
  return `${equipment}|${surgeon}|${salesrep}`;
}

/**
 * Extract safe booking properties for analysis (pure function)
 */
export function getSafeBookingProperties(booking: BookingData) {
  return Object.freeze({
    equipment: booking.equipment || BOOKING_DEFAULTS.EQUIPMENT,
    surgeon: booking.surgeon || BOOKING_DEFAULTS.SURGEON,
    salesrep: booking.salesrep || BOOKING_DEFAULTS.SALES_REP,
  });
}
