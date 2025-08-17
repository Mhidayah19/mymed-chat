/**
 * Time utilities for consistent timestamp generation
 */

/**
 * Get current timestamp as ISO string
 */
export const getCurrentTimestamp = (): string => new Date().toISOString();

/**
 * Get current date object
 */
export const getCurrentDate = (): Date => new Date();

/**
 * Pure function to create timestamp from date
 */
export const dateToTimestamp = (date: Date): string => date.toISOString();
