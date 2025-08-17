import { Agent, unstable_callable } from "agents";

type BookingData = {
  id: string;
  customer: string;
  customerId: string;
  surgeon: string;
  salesrep: string;
  equipment: string;
  date: string;
  status: string;
  value: number;
};

type BookingTemplate = {
  customer: string;
  customerId: string;
  equipment: string;
  surgeon: string;
  salesrep: string;
  frequency: number;
  totalBookings: number;
};

type BookingAnalysisState = {
  bookings: BookingData[];
  lastAnalysis: Date | null;
  cachedTemplates: BookingTemplate[];
  templatesGeneratedAt: string | null; // Use string instead of Date to avoid serialization issues
};

export class BookingAnalysisAgent extends Agent<Env, BookingAnalysisState> {
  initialState: BookingAnalysisState = {
    bookings: [],
    lastAnalysis: null,
    cachedTemplates: [],
    templatesGeneratedAt: null,
  };

  async onStart() {
    console.log(
      "📊 BookingAnalysisAgent started - ready for analysis requests"
    );

    // Disable automatic MCP monitoring to prevent Workers hanging
    // Auto-monitoring can be re-enabled later if needed
    console.log(
      "ℹ️ Automatic MCP monitoring is disabled to prevent hanging issues"
    );
  }

  @unstable_callable({ description: "Set booking data" })
  async setBookings(bookings: BookingData[]) {
    this.setState({
      bookings,
      lastAnalysis: new Date(),
      cachedTemplates: [], // Clear cached templates when new data arrives
      templatesGeneratedAt: null,
    });

    console.log(`📊 Booking data stored: ${bookings.length} bookings`);
    return {
      success: true,
      bookingsProcessed: bookings.length,
      analysisTimestamp: new Date(),
    };
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
    console.log("🧪 [TEST] Resetting analysis state");
    this.setState({
      lastAnalysis: null,
      bookings: [],
      cachedTemplates: [],
      templatesGeneratedAt: null,
    });
    return {
      success: true,
      message: "Analysis state reset successfully",
    };
  }

  @unstable_callable({
    description: "Show most common booking entries by customer",
  })
  async generateCommonBookingTemplates() {
    try {
      console.log("📋 Starting template generation");
      const bookings = this.state.bookings;
      console.log("📊 Available bookings:", bookings?.length || 0);

      if (!bookings || bookings.length === 0) {
        console.log("⚠️ No booking data available");
        return {
          success: false,
          message: "No booking data available",
          templates: [],
        };
      }

      // Group bookings by customer and find their most common combination
      const customerBookings = new Map<string, BookingData[]>();
      bookings.forEach((booking) => {
        if (!customerBookings.has(booking.customer)) {
          customerBookings.set(booking.customer, []);
        }
        customerBookings.get(booking.customer)!.push(booking);
      });

      const templates: BookingTemplate[] = [];

      // For each customer, find their most common booking combination
      customerBookings.forEach((customerBookingList, customerName) => {
        // Find most common equipment, surgeon, salesrep combination
        const combinationFreq = new Map<
          string,
          {
            equipment: string;
            surgeon: string;
            salesrep: string;
            count: number;
          }
        >();

        customerBookingList.forEach((booking) => {
          // Add null safety for booking properties
          const equipment = booking.equipment || "Unknown Equipment";
          const surgeon = booking.surgeon || "Unknown Surgeon";
          const salesrep = booking.salesrep || "Unknown Sales Rep";

          const key = `${equipment}|${surgeon}|${salesrep}`;
          if (combinationFreq.has(key)) {
            combinationFreq.get(key)!.count++;
          } else {
            combinationFreq.set(key, {
              equipment,
              surgeon,
              salesrep,
              count: 1,
            });
          }
        });

        // Get the most common combination
        const mostCommon = Array.from(combinationFreq.values()).sort(
          (a, b) => b.count - a.count
        )[0];

        if (mostCommon) {
          // Get customerId from the first booking for this customer
          const firstBooking = customerBookingList[0];
          const template: BookingTemplate = {
            customer: customerName,
            customerId: firstBooking.customerId || customerName,
            equipment: mostCommon.equipment,
            surgeon: mostCommon.surgeon,
            salesrep: mostCommon.salesrep,
            frequency: mostCommon.count,
            totalBookings: customerBookingList.length,
          };

          templates.push(template);
        }
      });

      // Sort by frequency (most common combinations first)
      templates.sort((a, b) => b.frequency - a.frequency);

      // Store templates in state
      this.setState({
        ...this.state,
        cachedTemplates: templates,
        templatesGeneratedAt: new Date().toISOString(), // Store as string
      });

      console.log(
        `📋 Found ${templates.length} most common booking patterns from ${bookings.length} bookings`
      );

      return {
        success: true,
        message: `Found ${templates.length} common booking patterns`,
        templates,
        generatedAt: new Date().toISOString(),
        sourceBookings: bookings.length,
      };
    } catch (error) {
      console.error("❌ Error generating booking templates:", error);
      console.error(
        "❌ Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate templates",
        templates: [],
        generatedAt: new Date().toISOString(),
        sourceBookings: this.state.bookings?.length || 0,
      };
    }
  }

  @unstable_callable({
    description:
      "Get cached booking templates (returns stored templates without regenerating)",
  })
  async getCachedTemplates() {
    try {
      console.log("📋 Getting cached templates");

      return {
        success: true,
        templates: this.state.cachedTemplates || [],
        generatedAt: this.state.templatesGeneratedAt || null, // Now it's already a string
        sourceBookings: this.state.bookings?.length || 0,
      };
    } catch (error) {
      console.error("❌ Error getting cached templates:", error);
      return {
        success: false,
        templates: [],
        generatedAt: null,
        sourceBookings: 0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get cached templates",
      };
    }
  }

  // REST endpoints for direct access
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      try {
        switch (true) {
          case url.pathname.endsWith("/bookings"):
            return Response.json(await this.getBookings());

          case url.pathname.endsWith("/reset"):
            return Response.json(await this.resetForTesting());

          case url.pathname.endsWith("/templates"):
            return Response.json(await this.generateCommonBookingTemplates());

          case url.pathname.endsWith("/cached-templates"):
            return Response.json(await this.getCachedTemplates());
        }
      } catch (error) {
        console.error("❌ Error in booking analysis endpoint:", error);
        console.error(
          "❌ Error stack:",
          error instanceof Error ? error.stack : "No stack"
        );
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            templates: [],
          },
          { status: 200 }
        ); // Return 200 with error info instead of 500
      }
    }

    if (request.method === "POST" && url.pathname.endsWith("/bookings")) {
      try {
        const { bookings } = (await request.json()) as {
          bookings: BookingData[];
        };
        return Response.json(await this.setBookings(bookings));
      } catch (error) {
        console.error("❌ Error setting bookings:", error);
        return Response.json(
          {
            success: false,
            error:
              error instanceof Error ? error.message : "Invalid booking data",
          },
          { status: 200 } // Return 200 with error info
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
