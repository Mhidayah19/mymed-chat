import { Agent, unstable_callable } from "agents";

type BookingData = {
  id: string;
  customer: string;
  surgeon: string;
  salesrep: string;
  equipment: string;
  date: string;
  status: string;
  value: number;
};

type AnalysisResult = {
  topCustomers: { name: string; bookings: number; value: number }[];
  topSurgeons: { name: string; bookings: number; equipment: string[] }[];
  topSalesreps: { name: string; bookings: number; revenue: number }[];
  topEquipment: { name: string; bookings: number; customers: string[] }[];
  statusDistribution: { status: string; count: number; percentage: number }[];
  monthlyTrends: { month: string; bookings: number; value: number }[];
  recommendations: string[];
};

type BookingAnalysisState = {
  bookings: BookingData[];
  lastAnalysis: Date | null;
  analysisResult: AnalysisResult | null;
  totalBookings: number;
  totalValue: number;
};

export class BookingAnalysisAgent extends Agent<Env, BookingAnalysisState> {
  initialState: BookingAnalysisState = {
    bookings: [],
    lastAnalysis: null,
    analysisResult: null,
    totalBookings: 0,
    totalValue: 0,
  };

  async onStart() {
    console.log("📊 BookingAnalysisAgent started - ready for analysis requests");
    
    // Start monitoring for MCP connections and auto-execute analysis
    await this.startMcpMonitoring();
  }

  private async startMcpMonitoring() {
    console.log("🔍 Starting MCP server monitoring for automatic booking analysis");
    
    // Check for existing MCP connections every 10 seconds
    const checkInterval = setInterval(async () => {
      try {
        await this.checkAndExecuteAnalysis();
      } catch (error) {
        console.error("❌ Error during MCP monitoring check:", error);
      }
    }, 10000); // Check every 10 seconds

    // Initial check immediately
    setTimeout(() => this.checkAndExecuteAnalysis(), 2000); // Wait 2 seconds for system to initialize
    
    // Store interval for cleanup if needed
    (this as any).mcpMonitoringInterval = checkInterval;
  }

  private async checkAndExecuteAnalysis() {
    try {
      console.log("🔍 [AUTO-CHECK] Checking for MCP connections...");
      
      // Get Chat agent to check for MCP connections
      const chatAgent = await this.env.Chat.get(this.env.Chat.idFromName("default"));
      
      // Make a request to check MCP servers
      const mcpCheckResponse = await chatAgent.fetch(new Request("https://dummy.com/list-mcp", {
        method: "GET"
      }));

      if (mcpCheckResponse.ok) {
        const mcpData = await mcpCheckResponse.json() as { servers?: Record<string, any> };
        const servers = mcpData.servers || {};
        const connectedServers = Object.keys(servers).filter(
          serverId => servers[serverId]?.state === "ready"
        );

        console.log(`🔗 [AUTO-CHECK] Found ${connectedServers.length} connected MCP servers`);
        console.log(`📊 [AUTO-CHECK] Last analysis: ${this.state.lastAnalysis ? 'EXISTS' : 'NONE'}`);

        if (connectedServers.length > 0 && !this.state.lastAnalysis) {
          console.log("🚀 [AUTO-TRIGGER] MCP servers detected - triggering automatic booking analysis");
          await this.triggerBookingAnalysis();
        } else if (connectedServers.length > 0) {
          console.log("ℹ️ [AUTO-SKIP] MCP servers available but analysis already completed");
        } else {
          console.log("⏳ [AUTO-WAIT] No ready MCP servers yet, will check again in 10s");
        }
      } else {
        console.log("❌ [AUTO-CHECK] Failed to get MCP server list");
      }
    } catch (error) {
      // Silently handle errors to avoid spam - MCP might not be ready yet
      if (error instanceof Error && !error.message.includes("fetch")) {
        console.warn("⚠️ [AUTO-ERROR] MCP monitoring check failed:", error.message);
      }
    }
  }

  private async triggerBookingAnalysis() {
    try {
      console.log("📊 Auto-triggering booking analysis via Chat agent");
      
      // Get Chat agent
      const chatAgent = await this.env.Chat.get(this.env.Chat.idFromName("default"));
      
      // Trigger the executeBookingAnalysis via internal fetch
      const analysisResponse = await chatAgent.fetch(new Request("https://dummy.com/execute-booking-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTrigger: true })
      }));

      if (analysisResponse.ok) {
        console.log("✅ Automatic booking analysis completed successfully");
      } else {
        console.warn("⚠️ Automatic booking analysis failed - will retry on next check");
      }
    } catch (error) {
      console.error("❌ Failed to trigger automatic booking analysis:", error);
    }
  }

  // Note: executeBookingAnalysis removed - Chat agent now handles all MCP communication
  // Use Chat agent's executeBookingAnalysis tool instead

  private async initializeMockData() {
    // Simplified mock data for testing when real MCP data is unavailable
    const mockBookings: BookingData[] = [
      {
        id: "DEMO001",
        customer: "Demo Hospital",
        surgeon: "Dr. Demo",
        salesrep: "Demo Sales Rep",
        equipment: "Demo Equipment",
        date: new Date().toISOString().split('T')[0],
        status: "demo",
        value: 50000,
      },
    ];

    console.log("📋 Using mock data (MCP unavailable)");
    await this.setBookings(mockBookings);
  }

  @unstable_callable({ description: "Set booking data and trigger analysis" })
  async setBookings(bookings: BookingData[]) {
    const analysisResult = this.analyzeBookings(bookings);
    const totalValue = bookings.reduce(
      (sum, booking) => sum + booking.value,
      0
    );

    this.setState({
      bookings,
      lastAnalysis: new Date(),
      analysisResult,
      totalBookings: bookings.length,
      totalValue,
    });

    console.log(
      `📊 Analysis complete: ${bookings.length} bookings, $${totalValue.toLocaleString()} total value`
    );
    return {
      success: true,
      bookingsProcessed: bookings.length,
      totalValue,
      analysisTimestamp: new Date(),
    };
  }

  private analyzeBookings(bookings: BookingData[]): AnalysisResult {
    // Analysis maps
    const customerMap = new Map<string, { bookings: number; value: number }>();
    const surgeonMap = new Map<string, { bookings: number; equipment: Set<string> }>();
    const salesrepMap = new Map<string, { bookings: number; revenue: number }>();
    const equipmentMap = new Map<string, { bookings: number; customers: Set<string> }>();
    const statusMap = new Map<string, number>();
    const monthlyMap = new Map<string, { bookings: number; value: number }>();

    bookings.forEach((booking) => {
      // Customer patterns
      const customer = customerMap.get(booking.customer) || { bookings: 0, value: 0 };
      customer.bookings++;
      customer.value += booking.value;
      customerMap.set(booking.customer, customer);

      // Surgeon patterns
      const surgeon = surgeonMap.get(booking.surgeon) || { bookings: 0, equipment: new Set() };
      surgeon.bookings++;
      surgeon.equipment.add(booking.equipment);
      surgeonMap.set(booking.surgeon, surgeon);

      // Sales rep patterns
      const salesrep = salesrepMap.get(booking.salesrep) || { bookings: 0, revenue: 0 };
      salesrep.bookings++;
      salesrep.revenue += booking.value;
      salesrepMap.set(booking.salesrep, salesrep);

      // Equipment patterns
      const equipment = equipmentMap.get(booking.equipment) || { bookings: 0, customers: new Set() };
      equipment.bookings++;
      equipment.customers.add(booking.customer);
      equipmentMap.set(booking.equipment, equipment);

      // Status distribution
      statusMap.set(booking.status, (statusMap.get(booking.status) || 0) + 1);

      // Monthly trends (with date validation)
      let month = new Date().toISOString().slice(0, 7); // Default to current month
      const bookingDate = new Date(booking.date);
      if (!isNaN(bookingDate.getTime())) {
        month = bookingDate.toISOString().slice(0, 7); // YYYY-MM format
      }
      
      const monthData = monthlyMap.get(month) || { bookings: 0, value: 0 };
      monthData.bookings++;
      monthData.value += booking.value;
      monthlyMap.set(month, monthData);
    });

    const topCustomers = Array.from(customerMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topSurgeons = Array.from(surgeonMap.entries())
      .map(([name, data]) => ({
        name,
        bookings: data.bookings,
        equipment: Array.from(data.equipment),
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    const topSalesreps = Array.from(salesrepMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top equipment analysis
    const topEquipment = Array.from(equipmentMap.entries())
      .map(([name, data]) => ({
        name,
        bookings: data.bookings,
        customers: Array.from(data.customers),
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    // Status distribution with percentages
    const totalBookings = bookings.length;
    const statusDistribution = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: Math.round((count / totalBookings) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Monthly trends
    const monthlyTrends = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Enhanced recommendations based on comprehensive analysis
    const recommendations = [
      `Focus on ${topCustomers[0]?.name || "top customer"} - they account for $${(topCustomers[0]?.value || 0).toLocaleString()} in bookings`,
      `Optimize ${topEquipment[0]?.name || "top equipment"} utilization - it's used in ${topEquipment[0]?.bookings || 0} bookings across ${topEquipment[0]?.customers?.length || 0} customers`,
      `${topSalesreps[0]?.name || "Top sales rep"} generated $${(topSalesreps[0]?.revenue || 0).toLocaleString()} revenue - consider expanding their territory`,
      statusDistribution[0] ? `${statusDistribution[0].percentage}% of bookings are "${statusDistribution[0].status}" - monitor for operational efficiency` : "Monitor booking status patterns",
      monthlyTrends.length > 1 ? `Booking trend: ${monthlyTrends[monthlyTrends.length - 1].bookings > monthlyTrends[monthlyTrends.length - 2].bookings ? "increasing" : "decreasing"} from last month` : "Establish baseline for monthly trends",
    ];

    return {
      topCustomers,
      topSurgeons,
      topSalesreps,
      topEquipment,
      statusDistribution,
      monthlyTrends,
      recommendations,
    };
  }

  @unstable_callable({ description: "Get current booking analysis results" })
  async getAnalysis() {
    return {
      lastAnalysis: this.state.lastAnalysis,
      totalBookings: this.state.totalBookings,
      totalValue: this.state.totalValue,
      analysisResult: this.state.analysisResult,
      summary: {
        topCustomer: this.state.analysisResult?.topCustomers[0]?.name || "None",
        topSurgeon: this.state.analysisResult?.topSurgeons[0]?.name || "None",
        topSalesrep: this.state.analysisResult?.topSalesreps[0]?.name || "None",
        topEquipment: this.state.analysisResult?.topEquipment[0]?.name || "None",
        mostCommonStatus: this.state.analysisResult?.statusDistribution[0]?.status || "None",
        totalMonths: this.state.analysisResult?.monthlyTrends?.length || 0,
      },
    };
  }

  @unstable_callable({ description: "Get all booking data" })
  async getBookings() {
    return {
      bookings: this.state.bookings,
      count: this.state.totalBookings,
      totalValue: this.state.totalValue,
    };
  }

  @unstable_callable({ description: "Get recommendations" })
  async getRecommendations() {
    return {
      recommendations: this.state.analysisResult?.recommendations || [],
      lastAnalysis: this.state.lastAnalysis,
    };
  }

  @unstable_callable({ description: "Get equipment analysis and usage patterns" })
  async getEquipmentAnalysis() {
    return {
      topEquipment: this.state.analysisResult?.topEquipment || [],
      statusDistribution: this.state.analysisResult?.statusDistribution || [],
      lastAnalysis: this.state.lastAnalysis,
    };
  }

  @unstable_callable({ description: "Get monthly trends and patterns" })
  async getMonthlyTrends() {
    return {
      monthlyTrends: this.state.analysisResult?.monthlyTrends || [],
      statusDistribution: this.state.analysisResult?.statusDistribution || [],
      lastAnalysis: this.state.lastAnalysis,
    };
  }

  @unstable_callable({ description: "Trigger fresh booking analysis from MCP" })
  async refreshAnalysis() {
    console.log("🔄 Manual refresh analysis triggered");
    console.log("Note: Use Chat agent's executeBookingAnalysis tool for MCP data refresh");
    return { 
      success: false, 
      message: "Use Chat agent's executeBookingAnalysis tool instead" 
    };
  }

  @unstable_callable({ description: "Reset analysis state to allow auto-trigger to run again" })
  async resetForTesting() {
    console.log("🧪 [TEST] Resetting analysis state for testing auto-trigger");
    this.setState({
      ...this.state,
      lastAnalysis: null,
      analysisResult: null,
      totalBookings: 0,
      totalValue: 0,
      bookings: []
    });
    return { 
      success: true, 
      message: "Analysis state reset - auto-trigger will run again on next MCP detection" 
    };
  }

  // REST endpoints for direct access
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      switch (true) {
        case url.pathname.endsWith("/analysis"):
          return Response.json(await this.getAnalysis());

        case url.pathname.endsWith("/bookings"):
          return Response.json(await this.getBookings());

        case url.pathname.endsWith("/recommendations"):
          return Response.json(await this.getRecommendations());

        case url.pathname.endsWith("/refresh"):
          return Response.json(await this.refreshAnalysis());

        case url.pathname.endsWith("/reset"):
          return Response.json(await this.resetForTesting());
      }
    }

    if (request.method === "POST" && url.pathname.endsWith("/bookings")) {
      try {
        const { bookings } = (await request.json()) as {
          bookings: BookingData[];
        };
        return Response.json(await this.setBookings(bookings));
      } catch (error) {
        return Response.json(
          { error: "Invalid booking data" },
          { status: 400 }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
