/**
 * Shared type definitions for consistent API responses and data structures
 */

// Standard API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// Booking analysis specific responses
export interface BookingAnalysisResponse<T = any> extends ApiResponse<T> {
  templates?: BookingTemplate[];
  generatedAt?: string | null;
  sourceBookings?: number;
  bookingsProcessed?: number;
  analysisTimestamp?: Date;
}

// Tool execution result
export interface ToolResult<T = any> {
  success: boolean;
  error?: string;
  data?: T;
  [key: string]: any; // Allow additional properties for flexibility
}

// Booking data structures (moved from booking-analysis-agent.ts)
export interface BookingData {
  id: string;
  customer: string;
  customerId: string;
  surgeon: string;
  salesrep: string;
  equipment: string;
  date: string;
  status: string;
  value: number;
}

export interface BookingTemplate {
  customer: string;
  customerId: string;
  equipment: string;
  surgeon: string;
  salesrep: string;
  frequency: number;
  totalBookings: number;
  // AI-enhanced fields
  confidence?: number;
  insights?: string;
  suggestedBookingRequest?: {
    customerId: string;
    customerName: string;
    equipment: string;
    surgeon: string;
    salesRepId: string;
    salesRepName: string;
    estimatedDate: string;
    notes: string;
    priority: "high" | "medium" | "low";
  };
}

export interface BookingAnalysisState {
  bookings: BookingData[];
  lastAnalysis: Date | null;
  cachedTemplates: BookingTemplate[];
  templatesGeneratedAt: string | null;
}

// Combination frequency tracking (internal type)
export interface CombinationFrequency {
  equipment: string;
  surgeon: string;
  salesrep: string;
  count: number;
}

// Error handling types
export interface ErrorDetails {
  message: string;
  stack?: string;
  code?: string;
}

// MCP tool argument types
export interface McpToolArgs {
  name: string;
  serverId: string;
  arguments?: Record<string, any>;
}

// HTTP response helpers
export interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
}
