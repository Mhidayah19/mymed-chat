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
      surgeryDate?: string; // ISO string or relative like "tomorrow", "next week", "next month", "next year"
      notes?: string;
      isDraft?: boolean;
    }
  ) {
    try {
      const templates = this.state.cachedTemplates || [];

      let template: any;
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
          t.surgeon
            .toLowerCase()
            .includes(customizations.surgeon!.toLowerCase())
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
      } else if (customizations.surgeryDate === "next week") {
        surgeryDate = new Date();
        surgeryDate.setDate(surgeryDate.getDate() + 7);
      } else if (customizations.surgeryDate === "next month") {
        surgeryDate = new Date();
        surgeryDate.setMonth(surgeryDate.getMonth() + 1);
      } else if (customizations.surgeryDate === "next year") {
        surgeryDate = new Date();
        surgeryDate.setFullYear(surgeryDate.getFullYear() + 1);
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

    // Create surgery schedule (UTC dates to avoid timezone issues)
    const dayOfUse = new Date(
      Date.UTC(
        surgeryDate.getFullYear(),
        surgeryDate.getMonth(),
        surgeryDate.getDate()
      )
    );

    const endOfUse = new Date(
      Date.UTC(
        surgeryDate.getFullYear(),
        surgeryDate.getMonth(),
        surgeryDate.getDate(),
        23,
        59,
        59,
        999
      )
    );

    // Only dayOfUse and endOfUse dates needed

    // Convert equipment name to material ID
    const materialId = template.equipment
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9-]/g, "");

    // Use template items if available, otherwise empty array
    const items =
      template.items && template.items.length > 0
        ? template.items.map((item: any) => ({
            quantity: item.quantity || 1,
            materialId: item.materialId || materialId || "UNKNOWN-EQUIPMENT",
          }))
        : [];

    return {
      items,
      notes: [
        {
          language: "EN",
          noteContent:
            customizations?.notes ||
            `${template.equipment} - ${template.surgeon} - ${template.salesrep}`,
        },
      ],
      isDraft: customizations?.isDraft !== false, // Default to draft
      currency: "EUR", // Use AI suggestion or default
      customer: template.customerId,
      customerName: template.customer, // Add customer name for richer display
      salesrep: template.salesrep, // Add back for UI display - will be filtered before MCP call
      dayOfUse: dayOfUse.toISOString(),
      endOfUse: endOfUse.toISOString(),
      description: template.equipment.substring(0, 15), // Truncate to 15 chars max
      equipmentDescription: template.equipment, // Full equipment description
      surgeryType: "OR", // Use AI suggestion or default
      isSimulation: true, // Allow override, default to true
      reservationType: template.reservationType || "01", // Use template data first, then AI suggestion
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
