import { Agent, Context } from "./agent";
import { createPortkey } from "@portkey-ai/gateway";
import LRUCache from "lru-cache";

export interface RoutingDecision {
  selectedAgentName: string;
  confidence: number;
  reasoning: string;
}

export class Router {
  private portkey;
  private agents: Agent[];
  private cache = new LRUCache<string, RoutingDecision>({ max: 100 });

  constructor(agents: Agent[]) {
    this.agents = agents;

    this.portkey = createPortkey({
      apiKey: "YOUR_PORTKEY_API_KEY",
      config: {
        provider: "openai",
        api_key: "YOUR_OPENAI_API_KEY",
        override_params: {
          model: "gpt-3.5-turbo",
          temperature: 0.0,
        },
      },
    });
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
      const response = await this.portkey.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
      });

      const assistantMessage = response.choices[0].message.content.trim();
      const routingResult = JSON.parse(assistantMessage);

      this.cache.set(cacheKey, routingResult);
      return routingResult;
    } catch (error) {
      console.error("Error in getRoutingDecision:", error);
      return {
        selectedAgentName: "local-agent",
        confidence: 1.0,
        reasoning: "Defaulting to local-agent due to an error.",
      };
    }
  }
}
