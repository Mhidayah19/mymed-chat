/**
 * AI-powered booking analysis using generateObject like server-tic.ts
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { BookingData, BookingTemplate } from "../types";

// Schema for AI-generated booking analysis
const BookingAnalysisSchema = z.object({
  customerPatterns: z.array(
    z.object({
      customer: z.string(),
      customerId: z.string(),
      equipment: z.string(),
      surgeon: z.string(),
      salesrep: z.string(),
      reservationType: z.string(),
      frequency: z.number(),
      totalBookings: z.number(),
      confidence: z.number().min(0).max(1), // AI confidence in this pattern
      insights: z.string(), // AI insights about this customer's preferences
      suggestedBookingRequest: z.object({
        customerId: z.string(),
        customerName: z.string(),
        equipment: z.string(),
        surgeon: z.string(),
        salesRepId: z.string(),
        salesRepName: z.string(),
        reservationType: z.string(),
        estimatedDate: z.string(),
        notes: z.string(),
        priority: z.enum(["high", "medium", "low"]),
      }),
    })
  ),
  overallInsights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type AIBookingAnalysis = z.infer<typeof BookingAnalysisSchema>;

export class AIBookingAnalyzer {
  private model = openai("gpt-4o");

  /**
   * Analyze booking patterns using AI and generate booking request bodies
   */
  async analyzeBookingPatterns(
    bookings: readonly BookingData[]
  ): Promise<BookingTemplate[]> {
    if (bookings.length === 0) {
      return [];
    }

    const { object } = await generateObject({
      model: this.model,
      prompt: `Analyze these medical equipment bookings and find the most common booking pattern for each customer.

${JSON.stringify(bookings, null, 2)}

For each customer, identify their MOST COMMON combination of:
- Equipment type
- Preferred surgeon
- Primary sales representative
- Reservation type

Then generate a ready-to-use booking request body for each customer based on their most common pattern.

CRITICAL FIELD MAPPING REQUIREMENTS:
- Equipment field MUST use items[0].materialId (e.g., "KLS-CRANIALSET") NOT items[0].description
- Use customerId field for customer identification
- Use surgeon field from booking data
- Use salesRepId from booking data

Instructions:
1. Find the most frequently used equipment + surgeon + sales rep + reservation type combination per customer
2. Calculate frequency (how many times this exact combination appears)
3. Provide confidence score (0.0 to 1.0) based on pattern consistency
4. Generate practical insights about each customer's booking preferences
5. Create a booking request body with realistic future date and helpful notes
6. Set priority based on booking frequency and customer importance

Focus on:
- Medical equipment booking context
- Practical scheduling considerations
- Business relationship insights
- Actionable booking recommendations

IMPORTANT: When extracting equipment information, ALWAYS use the materialId field (like "KLS-CRANIALSET") and NEVER use the description field (like "CRANIAL KIT W/ DRILL SPLINT MODEL").

Return only the single most common pattern per customer, not all patterns.`,
      schema: BookingAnalysisSchema,
    });

    // Transform AI response to BookingTemplate format
    return object.customerPatterns.map((pattern) =>
      Object.freeze({
        customer: pattern.customer,
        customerId: pattern.customerId,
        equipment: pattern.equipment,
        surgeon: pattern.surgeon,
        salesrep: pattern.salesrep,
        reservationType: pattern.reservationType,
        frequency: pattern.frequency,
        totalBookings: pattern.totalBookings,
        // Enhanced AI-generated fields
        confidence: pattern.confidence,
        insights: pattern.insights,
        suggestedBookingRequest: pattern.suggestedBookingRequest,
      })
    );
  }

  /**
   * Get overall booking insights from AI analysis
   */
  async getOverallInsights(bookings: readonly BookingData[]): Promise<{
    insights: string[];
    recommendations: string[];
  }> {
    if (bookings.length === 0) {
      return { insights: [], recommendations: [] };
    }

    const { object } = await generateObject({
      model: this.model,
      prompt: `Analyze these medical equipment bookings for overall business insights and recommendations:

${JSON.stringify(bookings, null, 2)}

Provide:
1. Overall insights about booking patterns, trends, and relationships
2. Business recommendations for improving efficiency and revenue
3. Strategic suggestions for customer relationship management

Focus on actionable business intelligence that would help a medical equipment company optimize their operations.`,
      schema: z.object({
        overallInsights: z.array(z.string()),
        recommendations: z.array(z.string()),
      }),
    });

    return {
      insights: object.overallInsights,
      recommendations: object.recommendations,
    };
  }
}
