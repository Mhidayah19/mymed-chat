/**
 * Common error handling utilities to reduce code duplication
 */

import type { ToolResult } from "../types";
import { getCurrentTimestamp } from "./time";

/**
 * Standardized error response creator (pure function)
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = "Operation failed"
): ToolResult {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;

  return Object.freeze({
    success: false as const,
    error: errorMessage,
  });
}

/**
 * Enhanced error response with stack trace logging (pure function)
 */
export function createDetailedErrorResponse(
  error: unknown,
  context: string,
  additionalData?: Record<string, any>
): ToolResult {
  const errorMessage =
    error instanceof Error ? error.message : `${context} failed`;

  console.error(`Error in ${context}:`, errorMessage);

  return Object.freeze({
    success: false as const,
    error: errorMessage,
    ...additionalData,
  });
}

/**
 * Success response creator for consistent formatting (pure function)
 */
export function createSuccessResponse<T = any>(
  data?: T,
  message?: string
): ToolResult<T> {
  return Object.freeze({
    success: true as const,
    ...(message && { message }),
    ...(data && { data }),
  });
}

/**
 * Booking analysis specific error response (pure function)
 */
export function createBookingErrorResponse(
  error: unknown,
  context: string
): any {
  const errorMessage =
    error instanceof Error ? error.message : `${context} failed`;

  return Object.freeze({
    success: false as const,
    message: errorMessage,
    templates: [],
    generatedAt: getCurrentTimestamp(),
    sourceBookings: 0,
  });
}

/**
 * Safe property access with default value
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
  return obj?.[path] ?? defaultValue;
}

/**
 * Safe property chain access (e.g., "booking.items[0].materialId")
 */
export function safeGetNested<T>(obj: any, path: string[], defaultValue: T): T {
  let current = obj;

  for (const key of path) {
    if (current == null) return defaultValue;

    // Handle array access like "items[0]"
    if (key.includes("[") && key.includes("]")) {
      const [arrayKey, indexStr] = key.split("[");
      const index = parseInt(indexStr.replace("]", ""), 10);
      current = current[arrayKey]?.[index];
    } else {
      current = current[key];
    }
  }

  return current ?? defaultValue;
}

/**
 * Async operation wrapper with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  fallbackValue?: T
): Promise<ToolResult<T>> {
  try {
    const result = await operation();
    return createSuccessResponse(result);
  } catch (error) {
    const errorResponse = createDetailedErrorResponse(error, context);

    if (fallbackValue !== undefined) {
      return {
        ...errorResponse,
        data: fallbackValue,
      };
    }

    return errorResponse;
  }
}
