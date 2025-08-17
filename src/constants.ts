/**
 * Application constants to eliminate magic strings and centralize configuration
 */

// Default values for booking data
export const BOOKING_DEFAULTS = {
  EQUIPMENT: "Unknown Equipment",
  SURGEON: "Unknown Surgeon",
  SALES_REP: "Unknown Sales Rep",
  CUSTOMER: "Unknown Customer",
  STATUS: "Unknown Status",
  ID: "unknown",
} as const;

// Agent names and identifiers
export const AGENT_NAMES = {
  MAIN_ANALYZER: "main-analyzer",
  MAIN_COUNTER: "main-counter",
} as const;

// API response messages
export const MESSAGES = {
  NO_BOOKING_DATA: "No booking data available",
  ANALYSIS_RESET_SUCCESS: "Analysis state reset successfully",
  ANALYSIS_START: "Starting template generation",
  BOOKING_DATA_STORED: "Booking data stored",
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
} as const;

// Logging prefixes
export const LOG_PREFIX = {
  SUCCESS: "✅",
  ERROR: "❌",
  WARNING: "⚠️",
  INFO: "ℹ️",
  DEBUG: "🔍",
  BOOKING: "📊",
  TEMPLATE: "📋",
  TEST: "🧪",
} as const;
