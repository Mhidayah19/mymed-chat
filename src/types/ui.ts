import type { BookingTemplate } from '../types';

/**
 * UI-specific interfaces for template display components
 */

export interface BookingTemplateItem {
  materialId?: string;
  name?: string;
  quantity: number;
  description?: string;
  availability?: string;
}

export interface TransformedTemplate {
  customer: string;
  customerId: string;
  surgeon: string;
  salesRep: string;  // Note: capitalized 'R' for UI consistency
  frequency: number;
  totalBookings: number;
  equipment: string;
  items?: BookingTemplateItem[];
  reservationType?: string;
  confidence?: number;
  insights?: string;
}

export interface TransformedTemplatesData {
  type: 'templates';
  templates: TransformedTemplate[];
  count: number;
  status: string;
}

export interface ContentResult {
  content?: Array<{ type: string; text: string }>;
}

// Update BookingTemplate interface in types.ts to include availability
export interface BookingTemplateItemExtended extends BookingTemplateItem {
  availability?: string;
}

// Helper type for tool invocation results
export interface BookingTemplatesResult {
  success: boolean;
  templates?: BookingTemplate[];
  generatedAt?: string;
  sourceBookings?: number;
}

export type ToolInvocationResult = ContentResult | BookingTemplatesResult;
