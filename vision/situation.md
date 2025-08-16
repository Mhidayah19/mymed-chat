Based on my understanding of the Cloudflare Agents framework, here's how I would implement the Medical Equipment Booking
Analysis System:

Architecture Overview

// Two-agent architecture:
// 1. BookingAnalysisAgent - Core analysis system with MCP integration
// 2. ChatAgent - AI assistant with knowledge of BookingAnalysisAgent

1. Booking Analysis Agent

```
  // src/booking-analysis-agent.ts
  import { Agent, unstable_callable, getCurrentAgent } from "agents";
  import { MCPClientManager } from "agents/mcp";
  import { generateObject } from "ai";
  import { openai } from "@ai-sdk/openai";
  import { z } from "zod";

  type Env = {
    OPENAI_API_KEY: string;
    BookingAnalysisAgent: DurableObjectNamespace<BookingAnalysisAgent>;
    ChatAgent: DurableObjectNamespace<ChatAgent>;
  };

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

  type AnalysisState = {
    lastAnalysis: Date | null;
    bookings: BookingData[];
    recommendations: {
      id: string;
      type: 'customer' | 'surgeon' | 'salesrep';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      data: any;
    }[];
    patterns: {
      topCustomers: { name: string; bookings: number; value: number }[];
      topSurgeons: { name: string; bookings: number; equipment: string[] }[];
      topSalesreps: { name: string; bookings: number; revenue: number }[];
    };
  };

  export class BookingAnalysisAgent extends Agent<Env, AnalysisState> {
    initialState: AnalysisState = {
      lastAnalysis: null,
      bookings: [],
      recommendations: [],
      patterns: {
        topCustomers: [],
        topSurgeons: [],
        topSalesreps: []
      }
    };

    async onStart() {
      // Auto-connect to MCP server and trigger analysis
      await this.connectToBookingMCP();
    }

    private async connectToBookingMCP() {
      try {
        // Connect to the booking MCP server
        const { authUrl } = await this.addMcpServer(
          "booking-system",
          "https://booking-mcp-server.example.com/mcp",
          "https://your-domain.com",
          "agents"
        );

        // If no auth required, immediately trigger booking fetch
        if (!authUrl) {
          await this.fetchAndAnalyzeBookings();
        }
      } catch (error) {
        console.error("Failed to connect to booking MCP server:", error);
      }
    }

    @unstable_callable({ description: "Fetch and analyze booking data" })
    async fetchAndAnalyzeBookings() {
      try {
        // Call getBooking tool from MCP server
        const bookingResult = await this.mcp.callTool({
          serverId: "booking-system",
          name: "getBooking",
          arguments: {}
        });

        const bookings = bookingResult.content[0]?.text
          ? JSON.parse(bookingResult.content[0].text)
          : [];

        // Analyze the booking data
        const analysis = await this.analyzeBookings(bookings);

        // Generate AI recommendations
        const recommendations = await this.generateRecommendations(analysis);

        // Update state
        this.setState({
          ...this.state,
          lastAnalysis: new Date(),
          bookings,
          recommendations,
          patterns: analysis
        });

        return {
          success: true,
          bookingsCount: bookings.length,
          recommendationsCount: recommendations.length
        };
      } catch (error) {
        console.error("Analysis failed:", error);
        return { success: false, error: error.message };
      }
    }

    private async analyzeBookings(bookings: BookingData[]) {
      // Customer analysis
      const customerMap = new Map<string, { bookings: number; value: number }>();
      const surgeonMap = new Map<string, { bookings: number; equipment: Set<string> }>();
      const salesrepMap = new Map<string, { bookings: number; revenue: number }>();

      bookings.forEach(booking => {
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

        // Salesrep patterns
        const salesrep = salesrepMap.get(booking.salesrep) || { bookings: 0, revenue: 0 };
        salesrep.bookings++;
        salesrep.revenue += booking.value;
        salesrepMap.set(booking.salesrep, salesrep);
      });

      return {
        topCustomers: Array.from(customerMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),

        topSurgeons: Array.from(surgeonMap.entries())
          .map(([name, data]) => ({ name, bookings: data.bookings, equipment: Array.from(data.equipment) }))
          .sort((a, b) => b.bookings - a.bookings)
          .slice(0, 10),

        topSalesreps: Array.from(salesrepMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
      };
    }

    private async generateRecommendations(patterns: AnalysisState['patterns']) {
      const recommendationSchema = z.object({
        recommendations: z.array(z.object({
          id: z.string(),
          type: z.enum(['customer', 'surgeon', 'salesrep']),
          title: z.string(),
          description: z.string(),
          priority: z.enum(['high', 'medium', 'low']),
          data: z.any()
        }))
      });

      const result = await generateObject({
        model: openai("gpt-4o"),
        schema: recommendationSchema,
        prompt: `
          Analyze this medical equipment booking data and generate exactly 3 actionable recommendations:

          Top Customers: ${JSON.stringify(patterns.topCustomers.slice(0, 5))}
          Top Surgeons: ${JSON.stringify(patterns.topSurgeons.slice(0, 5))}
          Top Sales Reps: ${JSON.stringify(patterns.topSalesreps.slice(0, 5))}

          Generate 3 specific, actionable recommendations focusing on:
          1. Customer relationship optimization
          2. Surgeon engagement strategies
          3. Sales team performance improvements

          Each recommendation should include specific data points and clear next steps.
        `
      });

      return result.object.recommendations;
    }

    @unstable_callable({ description: "Get current analysis results" })
    async getAnalysis() {
      return {
        lastAnalysis: this.state.lastAnalysis,
        bookingsCount: this.state.bookings.length,
        recommendations: this.state.recommendations,
        patterns: this.state.patterns
      };
    }

    @unstable_callable({ description: "Get booking data" })
    async getBookings() {
      return this.state.bookings;
    }

    // REST endpoints
    async onRequest(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "GET") {
        switch (path) {
          case "/analysis":
            return Response.json(await this.getAnalysis());

          case "/bookings":
            return Response.json(await this.getBookings());

          case "/recommendations":
            return Response.json(this.state.recommendations);

          case "/patterns":
            return Response.json(this.state.patterns);

          case "/trigger-analysis":
            const result = await this.fetchAndAnalyzeBookings();
            return Response.json(result);
        }
      }

      return new Response("Not Found", { status: 404 });
    }
  }
```

2. Chat Agent with Cross-Agent Knowledge

```
  // src/chat-agent.ts
  import { AIChatAgent } from "agents/ai-chat-agent";
  import { createDataStreamResponse, streamText } from "ai";
  import { openai } from "@ai-sdk/openai";
  import { getAgentByName } from "agents";

  type Env = {
    OPENAI_API_KEY: string;
    BookingAnalysisAgent: DurableObjectNamespace<BookingAnalysisAgent>;
    ChatAgent: DurableObjectNamespace<ChatAgent>;
  };

  export class ChatAgent extends AIChatAgent<Env> {
    async onChatMessage(onFinish) {
      return createDataStreamResponse({
        execute: async (dataStream) => {
          // Get access to BookingAnalysisAgent
          const bookingAgent = await getAgentByName(
            this.env.BookingAnalysisAgent,
            "main-analyzer"
          );

          const stream = streamText({
            model: openai("gpt-4o"),
            messages: this.messages,
            tools: {
              // Tool to get booking analysis
              getBookingAnalysis: {
                description: "Get the latest booking analysis results",
                parameters: z.object({}),
                execute: async () => {
                  return await bookingAgent.getAnalysis();
                }
              },

              // Tool to get specific booking data
              getBookingData: {
                description: "Get raw booking data",
                parameters: z.object({}),
                execute: async () => {
                  return await bookingAgent.getBookings();
                }
              },

              // Tool to trigger new analysis
              triggerAnalysis: {
                description: "Trigger a new booking analysis",
                parameters: z.object({}),
                execute: async () => {
                  return await bookingAgent.fetchAndAnalyzeBookings();
                }
              }
            },
            system: `
              You are an AI assistant with access to a medical equipment booking analysis system.

              You can:
              - Access current booking analysis results
              - View booking patterns and recommendations
              - Trigger new analysis when needed
              - Answer questions about customer, surgeon, and sales rep performance

              The booking analysis agent automatically analyzes data and generates AI-powered recommendations.
              Use the available tools to provide detailed insights about the booking system.
            `,
            onFinish
          });

          stream.mergeIntoDataStream(dataStream);
        }
      });
    }
  }

```

3. Worker Configuration & Routing

```
  // src/server.ts
  import { routeAgentRequest } from "agents";

  export { BookingAnalysisAgent, ChatAgent };

  export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      return await routeAgentRequest(request, env, {
        cors: true
      });
    }
  } satisfies ExportedHandler<Env>;

  4. Wrangler Configuration

  // wrangler.jsonc
  {
    "name": "medical-booking-analysis",
    "compatibility_date": "2024-12-01",
    "main": "src/server.ts",
    "durable_objects": {
      "bindings": [
        {
          "name": "BookingAnalysisAgent",
          "class_name": "BookingAnalysisAgent"
        },
        {
          "name": "ChatAgent",
          "class_name": "ChatAgent"
        }
      ]
    },
    "migrations": [
      {
        "tag": "v1",
        "new_sqlite_classes": ["BookingAnalysisAgent", "ChatAgent"]
      }
    ],
    "vars": {
      "OPENAI_API_KEY": "your-key-here"
    }
  }

```

Key Features Implemented

Auto-Execution Flow

1. MCP Connection: onStart() automatically connects to booking MCP server
2. Auto-Trigger: Immediately calls getBooking tool upon connection
3. Analysis Pipeline: Data → Pattern Analysis → AI Recommendations → State Storage

Cross-Agent Communication

- ChatAgent has direct access to BookingAnalysisAgent via getAgentByName()
- Real-time access to analysis results through callable methods
- Tools available to trigger new analysis or access cached data

Persistent State Management

- Analysis results stored in Durable Object state
- Survives agent hibernation and restarts
- Accessible via both RPC and REST endpoints

AI-Powered Recommendations

- Uses OpenAI GPT-4 with structured output (Zod schemas)
- Generates 3 specific recommendations based on booking patterns
- Categorized by customer, surgeon, and salesrep insights

REST API Endpoints

- /analysis - Full analysis results
- /bookings - Raw booking data
- /recommendations - AI recommendations
- /patterns - Data patterns
- /trigger-analysis - Manual analysis trigger

This architecture provides a robust, scalable system that automatically processes booking data and makes insights available to
both programmatic access and conversational AI interfaces.
