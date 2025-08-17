/**
 * Booking analysis utilities to break down complex analysis logic
 */

import type {
  BookingData,
  BookingTemplate,
  CombinationFrequency,
} from "../types";
import {
  getSafeBookingProperties,
  createCombinationKey,
} from "./booking-transform";

/**
 * Group bookings by customer for analysis (pure function)
 */
export function groupBookingsByCustomer(
  bookings: readonly BookingData[]
): Map<string, BookingData[]> {
  return bookings.reduce((customerMap, booking) => {
    const customer = booking.customer;
    const existingBookings = customerMap.get(customer) || [];

    return new Map(customerMap).set(customer, [...existingBookings, booking]);
  }, new Map<string, BookingData[]>());
}

/**
 * Find the most common equipment-surgeon-salesrep combination for a customer (pure function)
 */
export function findMostCommonCombination(
  customerBookings: readonly BookingData[]
): CombinationFrequency | null {
  if (customerBookings.length === 0) return null;

  const combinationFreq = customerBookings.reduce((freqMap, booking) => {
    const { equipment, surgeon, salesrep } = getSafeBookingProperties(booking);
    const key = createCombinationKey(equipment, surgeon, salesrep);

    const existing = freqMap.get(key);
    const updated = existing
      ? { ...existing, count: existing.count + 1 }
      : { equipment, surgeon, salesrep, count: 1 };

    return new Map(freqMap).set(key, updated);
  }, new Map<string, CombinationFrequency>());

  const combinations = Array.from(combinationFreq.values());
  return combinations.sort((a, b) => b.count - a.count)[0] || null;
}

/**
 * Create a booking template from the most common combination (pure function)
 */
export function createBookingTemplate(
  customerName: string,
  customerBookings: readonly BookingData[],
  mostCommon: CombinationFrequency
): BookingTemplate {
  const firstBooking = customerBookings[0];

  return Object.freeze({
    customer: customerName,
    customerId: firstBooking?.customerId || customerName,
    equipment: mostCommon.equipment,
    surgeon: mostCommon.surgeon,
    salesrep: mostCommon.salesrep,
    frequency: mostCommon.count,
    totalBookings: customerBookings.length,
  });
}

/**
 * Generate templates for all customers (pure function)
 */
export function generateCustomerTemplates(
  customerBookings: Map<string, readonly BookingData[]>
): BookingTemplate[] {
  return Array.from(customerBookings.entries())
    .map(([customerName, bookingList]) => {
      const mostCommon = findMostCommonCombination(bookingList);
      return mostCommon
        ? createBookingTemplate(customerName, bookingList, mostCommon)
        : null;
    })
    .filter((template): template is BookingTemplate => template !== null);
}

/**
 * Sort templates by frequency (most common first) - pure function
 */
export function sortTemplatesByFrequency(
  templates: readonly BookingTemplate[]
): BookingTemplate[] {
  return [...templates].sort((a, b) => b.frequency - a.frequency);
}

/**
 * Main analysis function that orchestrates the entire process (pure function)
 */
export function analyzeBookingPatterns(
  bookings: readonly BookingData[]
): BookingTemplate[] {
  if (bookings.length === 0) return [];

  // Function composition approach
  const pipeline = (data: readonly BookingData[]): BookingTemplate[] => {
    const grouped = groupBookingsByCustomer(data);
    const templates = generateCustomerTemplates(grouped);
    return sortTemplatesByFrequency(templates);
  };

  return pipeline(bookings);
}
