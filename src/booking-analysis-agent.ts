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

  @unstable_callable({
    description:
      "Generate complete booking request body for a customer based on their usual patterns",
  })
  async generateBookingRequest(
    customerName?: string,
    customizations?: {
      surgeon?: string;
      surgeryDate?: string; // ISO string or relative like "tomorrow"
      surgeryTime?: string; // e.g., "2pm", "14:00"
      deliveryTime?: string;
      notes?: string;
      isDraft?: boolean;
    }
  ) {
    try {
      const templates = this.state.cachedTemplates || [];

      let template;
      let searchCriteria = "";

      // Search by customer name if provided
      if (customerName) {
        template = templates.find(
          (t) =>
            t.customer.toLowerCase().includes(customerName.toLowerCase()) ||
            t.customerId.toLowerCase().includes(customerName.toLowerCase())
        );
        searchCriteria = `customer "${customerName}"`;

        // If surgeon is also provided, further filter the found template
        if (template && customizations?.surgeon) {
          const surgeonMatch = template.surgeon
            .toLowerCase()
            .includes(customizations.surgeon.toLowerCase());
          if (!surgeonMatch) {
            template = undefined;
            searchCriteria = `customer "${customerName}" with surgeon "${customizations.surgeon}"`;
          }
        }
      }
      // Search by surgeon name if no customer name provided
      else if (customizations?.surgeon) {
        template = templates.find((t) =>
          t.surgeon.toLowerCase().includes(customizations.surgeon!.toLowerCase())
        );
        searchCriteria = `surgeon "${customizations.surgeon}"`;
      }

      if (!template) {
        const availableInfo =
          customerName || customizations?.surgeon
            ? `Available customers: ${templates.map((t) => t.customer).join(", ")}. Available surgeons: ${[...new Set(templates.map((t) => t.surgeon))].join(", ")}`
            : "Please provide either customerName or surgeon parameter";

        return {
          success: false as const,
          error: `No template found for ${searchCriteria}. ${availableInfo}`,
        };
      }

      // Generate booking request body using frontend logic
      const bookingRequest = this.generateBookingRequestBody(
        template,
        customizations
      );

      return {
        success: true as const,
        customer: template.customer,
        customerId: template.customerId,
        confidence: template.confidence || 0,
        requestBody: bookingRequest,
        templateUsed: {
          equipment: template.equipment,
          surgeon: template.surgeon,
          salesrep: template.salesrep,
          frequency: template.frequency,
          totalBookings: template.totalBookings,
        },
      };
    } catch (error) {
      console.error("Error generating booking request:", error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate booking request",
      };
    }
  }

  /**
   * Private method that replicates the frontend's booking request body generation logic
   */
  private generateBookingRequestBody(template: any, customizations?: any) {
    // Parse surgery date
    let surgeryDate = new Date();
    if (customizations?.surgeryDate) {
      if (customizations.surgeryDate === "tomorrow") {
        surgeryDate = new Date();
        surgeryDate.setDate(surgeryDate.getDate() + 1);
      } else {
        surgeryDate = new Date(customizations.surgeryDate);
      }
    } else {
      // Default to next business day
      surgeryDate = new Date();
      surgeryDate.setDate(surgeryDate.getDate() + 1);
    }

    // Skip weekends - find next business day
    while (surgeryDate.getDay() === 0 || surgeryDate.getDay() === 6) {
      surgeryDate.setDate(surgeryDate.getDate() + 1);
    }

    // Parse surgery time
    let surgeryHour = 8; // Default 8 AM
    let surgeryMinute = 0;
    if (customizations?.surgeryTime) {
      const timeMatch = customizations.surgeryTime.match(
        /(\d+):?(\d*)\s*(am|pm)?/i
      );
      if (timeMatch) {
        surgeryHour = parseInt(timeMatch[1]);
        surgeryMinute = parseInt(timeMatch[2] || "0");
        if (timeMatch[3]?.toLowerCase() === "pm" && surgeryHour < 12) {
          surgeryHour += 12;
        }
      }
    }

    // Create surgery schedule
    const dayOfUse = new Date(surgeryDate);
    dayOfUse.setHours(surgeryHour, surgeryMinute, 0, 0);

    const endOfUse = new Date(surgeryDate);
    endOfUse.setHours(18, 0, 0, 0); // End at 6 PM

    // Delivery day before at 10 AM (or custom time)
    const deliveryDate = new Date(surgeryDate);
    deliveryDate.setDate(deliveryDate.getDate() - 1);
    deliveryDate.setHours(10, 0, 0, 0);

    // Return day after at 4 PM
    const returnDate = new Date(surgeryDate);
    returnDate.setDate(returnDate.getDate() + 1);
    returnDate.setHours(16, 0, 0, 0);

    // Convert equipment name to material ID
    const materialId = template.equipment
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9-]/g, "");

    // Generate booking request body (matches frontend logic)
    return {
      items: [
        {
          quantity: 1,
          materialId: materialId || "UNKNOWN-EQUIPMENT",
        },
      ],
      notes: [
        {
          language: "EN",
          noteContent:
            customizations?.notes ||
            `${template.equipment} - ${template.surgeon}`,
        },
      ],
      isDraft: customizations?.isDraft !== false, // Default to draft
      currency: "EUR",
      customerId: template.customerId,
      dayOfUse: dayOfUse.toISOString(),
      endOfUse: endOfUse.toISOString(),
      returnDate: returnDate.toISOString(),
      description: template.equipment,
      surgeryType: "OR",
      deliveryDate: deliveryDate.toISOString(),
      isSimulation: true,
      collectionDate: returnDate.toISOString(),
      reservationType: "01",
      surgeryDescription: template.surgeon,
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
