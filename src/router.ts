import { Agent, Context } from "./agent";
import { createPortkey, PortkeyClient } from "@portkey-ai/vercel-provider";
import { generateText } from "ai";
import { LRUCache } from "lru-cache";
import Portkey from "portkey-ai";

export interface RoutingDecision {
  selectedAgentName: string;
  confidence: number;
  reasoning: string;
}

export class Router {
  private portkey;
  private agents: Agent[];
  private cache: LRUCache<string, RoutingDecision>;
  portkeyClient: any;

  constructor(agents: Agent[]) {
    this.agents = agents;
    this.cache = new LRUCache({ max: 1000 });

    const portkeyConfig = {
      provider: "openai",
      api_key: process.env.OPENAI_API_KEY,
      override_params: {
        model: "gpt-4",
        // temperature: 0.0,
      },
    };

    this.portkeyClient = new Portkey({
      apiKey: process.env.PORTKEY_API_KEY,
      baseURL: process.env.PORTKEY_BASE_URL,
      config: portkeyConfig,
    });

    this.portkey = createPortkey({
      //   provider: "openai",
      apiKey: process.env.PORTKEY_API_KEY,
      baseURL: process.env.PORTKEY_BASE_URL,
      config: portkeyConfig,
    });

    // console.log("Portkey:", this.portkey);
  }

  async getRoutingDecision(
    content: string,
    context: Context
  ): Promise<RoutingDecision> {
    const cacheKey = content;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const systemPrompt = `
You are a routing assistant. Based on the user's request, determine the most appropriate agent from the following list:

${this.agents
  .map((agent) => `- ${agent.name}: ${agent.capabilities.join(", ")}`)
  .join("\n")}

Respond with a JSON object containing:
- "selectedAgentName": The name of the chosen agent.
- "confidence": A number between 0 and 1 indicating your confidence.
- "reasoning": A brief explanation for your choice.

Only provide the JSON object in your response.
`;

    try {
      const model = this.portkey.chatModel("gpt-4");

      //   const result = await this.portkeyClient.chat.completions.create({
      //     messages: [
      //       { role: "system", content: systemPrompt },
      //       { role: "user", content },
      //     ],
      //     model: "gpt-4", // Specify the model here
      //   });

      //   console.log("PORTKEY CLIENT Response:", { response: result });

      //   console.log("Model:", model);
      const result = await generateText({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
      });

      // Log all properties of the result
      console.log("GenerateText Result:", {
        ...result,
      });

      const routingResult = JSON.parse(result?.text);
      console.log("Routing Result:", JSON.stringify(routingResult, null, 2));
      this.cache.set(cacheKey, routingResult);
      return routingResult;
    } catch (error) {
      // Enhanced error logging
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const timestamp = new Date().toISOString();
      console.error("Full error object:", error);
      if (error instanceof Error) {
        console.error("Error stack trace:", error.stack);
      }

      console.error(
        `[${timestamp}] Error in getRoutingDecision: ${errorMessage}`
      );
      console.error(`Context: ${JSON.stringify(context)}`);
      console.error(`Content: ${content}`);

      // Optionally, you can throw a custom error or return a default response
      throw new Error(
        "Failed to get routing decision. Please try again later."
      );
    }
  }
}
