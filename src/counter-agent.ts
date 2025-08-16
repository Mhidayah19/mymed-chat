import { Agent, unstable_callable } from "agents";

type CounterState = {
  count: number;
  lastUpdated: Date | null;
};

export class CounterAgent extends Agent<Env, CounterState> {
  initialState: CounterState = {
    count: 0,
    lastUpdated: null,
  };

  @unstable_callable({ description: "Increment the counter by 1" })
  async increment() {
    this.setState({
      count: this.state.count + 1,
      lastUpdated: new Date(),
    });
    console.log(`Counter incremented to: ${this.state.count}`);
    return { count: this.state.count };
  }

  @unstable_callable({ description: "Get current counter value" })
  async getCount() {
    return {
      count: this.state.count,
      lastUpdated: this.state.lastUpdated,
    };
  }

  @unstable_callable({ description: "Reset counter to 0" })
  async reset() {
    this.setState({
      count: 0,
      lastUpdated: new Date(),
    });
    console.log("Counter reset to 0");
    return { count: 0 };
  }

  @unstable_callable({ description: "Add a specific value to counter" })
  async add(value: number) {
    this.setState({
      count: this.state.count + value,
      lastUpdated: new Date(),
    });
    console.log(`Added ${value} to counter, new value: ${this.state.count}`);
    return { count: this.state.count, added: value };
  }

  // REST endpoint for direct access
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname.endsWith("/count")) {
      return Response.json(await this.getCount());
    }

    if (request.method === "POST" && url.pathname.endsWith("/increment")) {
      return Response.json(await this.increment());
    }

    if (request.method === "POST" && url.pathname.endsWith("/reset")) {
      return Response.json(await this.reset());
    }

    if (request.method === "POST" && url.pathname.endsWith("/add")) {
      try {
        const body = (await request.json()) as { value: number };
        const value = body.value || 1;
        return Response.json(await this.add(value));
      } catch (error) {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
