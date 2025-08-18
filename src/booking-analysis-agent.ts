import { Agent, unstable_callable } from "agents";
import { LOG_PREFIX } from "./constants";
import type { BookingData, BookingAnalysisState } from "./types";
import { AIBookingAnalyzer } from "./utils/ai-booking-analyzer";

export class BookingAnalysisAgent extends Agent<Env, BookingAnalysisState> {
  private aiAnalyzer = new AIBookingAnalyzer();

  initialState: BookingAnalysisState = {
    bookings: [],
    lastAnalysis: null,
    cachedTemplates: [],
    templatesGeneratedAt: null,
  };

  async onStart() {
    console.log(`${LOG_PREFIX.BOOKING} BookingAnalysisAgent ready`);
  }

  @unstable_callable({ description: "Set booking data" })
  async setBookings(bookings: BookingData[]) {
    this.setState({
      ...this.state,
      bookings: [...bookings],
      lastAnalysis: new Date(),
      cachedTemplates: [],
      templatesGeneratedAt: null,
    });

    console.log(`${LOG_PREFIX.BOOKING} Stored ${bookings.length} bookings`);
    return {
      success: true as const,
      bookingsProcessed: bookings.length,
      analysisTimestamp: new Date(),
    };
  }



  @unstable_callable({
    description: "Show most common booking entries by customer",
  })
  async generateCommonBookingTemplates() {
    try {
      const bookings = this.state.bookings;

      if (!bookings || bookings.length === 0) {
        return {
          success: false as const,
          message: "No booking data available",
          templates: [],
        };
      }

      // Use AI to analyze booking patterns and generate booking requests
      const templates = await this.aiAnalyzer.analyzeBookingPatterns(bookings);

      this.setState({
        ...this.state,
        cachedTemplates: [...templates],
        templatesGeneratedAt: new Date().toISOString(),
      });

      return {
        success: true as const,
        message: `Found ${templates.length} patterns with AI analysis`,
        templates: [...templates],
        generatedAt: new Date().toISOString(),
        sourceBookings: bookings.length,
      };
    } catch (error) {
      console.error("Error generating booking templates:", error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate templates",
        templates: [],
        generatedAt: new Date().toISOString(),
        sourceBookings: this.state.bookings?.length || 0,
      };
    }
  }

  @unstable_callable({ description: "Get cached booking templates" })
  async getCachedTemplates() {
    return {
      success: true as const,
      templates: [...(this.state.cachedTemplates || [])],
      generatedAt: this.state.templatesGeneratedAt,
      sourceBookings: this.state.bookings?.length || 0,
    };
  }

  // Essential REST endpoints for frontend panel
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET") {
      if (pathname.endsWith("/templates")) {
        return Response.json(await this.generateCommonBookingTemplates());
      }
      if (pathname.endsWith("/cached-templates")) {
        return Response.json(await this.getCachedTemplates());
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
