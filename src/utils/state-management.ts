/**
 * Functional state management utilities following immutable patterns
 */

import type {
  BookingData,
  BookingAnalysisState,
  BookingTemplate,
} from "../types";
import { getCurrentDate, getCurrentTimestamp } from "./time";

/**
 * Pure function to create a new state with updated bookings
 */
export const createStateWithBookings = (
  currentState: BookingAnalysisState,
  bookings: BookingData[]
): BookingAnalysisState => ({
  ...currentState,
  bookings: [...bookings], // Immutable copy
  lastAnalysis: getCurrentDate(),
  cachedTemplates: [], // Clear cache when new data arrives
  templatesGeneratedAt: null,
});

/**
 * Pure function to create a new state with cached templates
 */
export const createStateWithTemplates = (
  currentState: BookingAnalysisState,
  templates: BookingTemplate[]
): BookingAnalysisState => ({
  ...currentState,
  cachedTemplates: [...templates], // Immutable copy
  templatesGeneratedAt: getCurrentTimestamp(),
});

/**
 * Pure function to create a reset state
 */
export const createResetState = (): BookingAnalysisState => ({
  bookings: [],
  lastAnalysis: null,
  cachedTemplates: [],
  templatesGeneratedAt: null,
});

/**
 * Pure function to create booking analysis response
 */
export const createBookingAnalysisResponse = (
  templates: BookingTemplate[],
  sourceBookingsCount: number
) => ({
  success: true as const,
  message: `Found ${templates.length} patterns`,
  templates: [...templates], // Immutable copy
  generatedAt: getCurrentTimestamp(),
  sourceBookings: sourceBookingsCount,
});

/**
 * Pure function to create setBookings response
 */
export const createSetBookingsResponse = (bookingsCount: number) => ({
  success: true as const,
  bookingsProcessed: bookingsCount,
  analysisTimestamp: getCurrentDate(),
});

/**
 * Pure function to create cached templates response
 */
export const createCachedTemplatesResponse = (
  templates: BookingTemplate[],
  generatedAt: string | null,
  sourceBookingsCount: number
) => ({
  success: true as const,
  templates: [...templates], // Immutable copy
  generatedAt,
  sourceBookings: sourceBookingsCount,
});

/**
 * Pure function to create empty templates response
 */
export const createEmptyTemplatesResponse = () => ({
  success: false as const,
  message: "No booking data available",
  templates: [] as BookingTemplate[],
});

/**
 * Pure function to validate if bookings exist
 */
export const hasValidBookings = (
  bookings: BookingData[] | null | undefined
): boolean => Boolean(bookings && bookings.length > 0);

/**
 * Pure function to get bookings count safely
 */
export const getBookingsCount = (
  bookings: BookingData[] | null | undefined
): number => bookings?.length || 0;
