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
      customer: z.string().describe("Customer name"),
      customerId: z.string().describe("Customer ID"),
      equipment: z.string(), // Primary equipment name for display
      items: z.array(z.object({
        materialId: z.string().describe("Material ID"),
        quantity: z.number().describe("Quantity"),
        description: z.string().optional().describe("Description"),
      })),
      surgeon: z.string().describe("Surgeon name"),
      salesrep: z.string().describe("Sales representative name"),
      reservationType: z.string().describe("Reservation type"),
      frequency: z.number().describe("Frequency"),
      totalBookings: z.number().describe("Total bookings"),
      confidence: z.number().min(0).max(1).describe("AI confidence in this pattern"), // AI confidence in this pattern
      insights: z.string().describe("AI insights about this customer's preferences"), // AI insights about this customer's preferences
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
- Equipment/materials combination (including quantities)
- Preferred surgeon
- Primary sales representative
- Reservation type

Then generate a ready-to-use booking request body for each customer based on their most common pattern.

CRITICAL FIELD MAPPING REQUIREMENTS:
- Equipment field should be a descriptive name (e.g., "Spine Surgery Set", "Cranial Kit")
- Items array should contain ALL materials with exact quantities from the most common pattern
- Use customerId field for customer identification
- Use surgeon field from booking data
- Use salesRepId from booking data
- Preserve exact quantities from historical bookings

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

IMPORTANT: 
- Equipment field should be a human-readable name like "Spine Surgery Set" or "Cranial Kit"
- NEVER put JSON arrays or materialId codes in the equipment field
- Items array should contain the actual materialId codes and quantities
- Notes should be human-readable text, not JSON

Return only the single most common pattern per customer, not all patterns.`,
      schema: BookingAnalysisSchema,
    });

    // Transform AI response to BookingTemplate format
    return object.customerPatterns.map((pattern) =>
      Object.freeze({
        customer: pattern.customer,
        customerId: pattern.customerId,
        equipment: pattern.equipment,
        items: pattern.items, // Include full items array with quantities
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
