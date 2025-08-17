import { Agent, unstable_callable } from "agents";
import { LOG_PREFIX } from "./constants";
import type { BookingData, BookingAnalysisState } from "./types";
import {
  createErrorResponse,
  createDetailedErrorResponse,
} from "./utils/error-handling";
import { analyzeBookingPatterns } from "./utils/booking-analysis";
import {
  createStateWithBookings,
  createStateWithTemplates,
  createResetState,
  createBookingAnalysisResponse,
  createSetBookingsResponse,
  createCachedTemplatesResponse,
  createEmptyTemplatesResponse,
  hasValidBookings,
  getBookingsCount,
} from "./utils/state-management";
import { getCurrentTimestamp } from "./utils/time";
import { BookingRoutes, isBookingRoute } from "./utils/routing";
import {
  createJsonResponse,
  createNotFoundResponse,
  createErrorJsonResponse,
} from "./utils/response";

export class BookingAnalysisAgent extends Agent<Env, BookingAnalysisState> {
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
    const newState = createStateWithBookings(this.state, bookings);
    this.setState(newState);

    console.log(`${LOG_PREFIX.BOOKING} Stored ${bookings.length} bookings`);
    return createSetBookingsResponse(bookings.length);
  }

  @unstable_callable({ description: "Get all booking data" })
  async getBookings() {
    return {
      bookings: this.state.bookings,
      count: this.state.bookings.length,
    };
  }

  @unstable_callable({
    description: "Reset analysis state",
  })
  async resetForTesting() {
    const newState = createResetState();
    this.setState(newState);
    return {
      success: true,
      message: "Analysis state reset",
    };
  }

  @unstable_callable({
    description: "Show most common booking entries by customer",
  })
  async generateCommonBookingTemplates() {
    try {
      const bookings = this.state.bookings;

      if (!hasValidBookings(bookings)) {
        return createEmptyTemplatesResponse();
      }

      const templates = analyzeBookingPatterns(bookings);
      const newState = createStateWithTemplates(this.state, templates);
      this.setState(newState);

      return createBookingAnalysisResponse(templates, bookings.length);
    } catch (error) {
      return createDetailedErrorResponse(
        error,
        "generating booking templates",
        {
          templates: [],
          generatedAt: getCurrentTimestamp(),
          sourceBookings: getBookingsCount(this.state.bookings),
        }
      );
    }
  }

  @unstable_callable({
    description:
      "Get cached booking templates (returns stored templates without regenerating)",
  })
  async getCachedTemplates() {
    try {
      return createCachedTemplatesResponse(
        this.state.cachedTemplates || [],
        this.state.templatesGeneratedAt,
        getBookingsCount(this.state.bookings)
      );
    } catch (error) {
      return createDetailedErrorResponse(error, "getting cached templates", {
        templates: [],
        generatedAt: null,
        sourceBookings: 0,
      });
    }
  }

  // REST endpoints for direct access
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      try {
        const { pathname } = url;

        if (isBookingRoute(pathname, BookingRoutes.BOOKINGS)) {
          return createJsonResponse(await this.getBookings());
        }

        if (isBookingRoute(pathname, BookingRoutes.RESET)) {
          return createJsonResponse(await this.resetForTesting());
        }

        if (isBookingRoute(pathname, BookingRoutes.TEMPLATES)) {
          return createJsonResponse(
            await this.generateCommonBookingTemplates()
          );
        }

        if (isBookingRoute(pathname, BookingRoutes.CACHED_TEMPLATES)) {
          return createJsonResponse(await this.getCachedTemplates());
        }
      } catch (error) {
        const errorResponse = createDetailedErrorResponse(
          error,
          "booking analysis endpoint",
          { templates: [] }
        );
        return createErrorJsonResponse(errorResponse);
      }
    }

    if (
      request.method === "POST" &&
      isBookingRoute(url.pathname, BookingRoutes.BOOKINGS)
    ) {
      try {
        const { bookings } = (await request.json()) as {
          bookings: BookingData[];
        };
        return createJsonResponse(await this.setBookings(bookings));
      } catch (error) {
        const errorResponse = createErrorResponse(
          error,
          "Setting bookings failed"
        );
        return createErrorJsonResponse(errorResponse);
      }
    }

    return createNotFoundResponse();
  }
}
