import { BaseAgent } from "./baseAgent";
import { AgentResponse, Context } from "../agent";
import { createPortkey } from "@portkey-ai/gateway";

export class LocalAgent extends BaseAgent {
  private portkey;

  constructor() {
    super("local-agent", [
      "general conversation",
      "creative writing",
      "analysis",
    ]);
    this.portkey = createPortkey({
      apiKey: "YOUR_PORTKEY_API_KEY",
      config: {
        provider: "ollama",
        customHost: "http://localhost:11434",
        override_params: { model: "llama2" },
      },
    });
  }

  async handleRequest(
    content: string,
    context: Context
  ): Promise<AgentResponse> {
    if (content.toLowerCase().includes("execute a code")) {
      return {
        response: "",
        handoffAgentName: "computer-agent",
        reasoning: "The request involves code execution.",
      };
    }

    const response = await this.portkey.chat.completions.create({
      messages: [{ role: "user", content }],
    });

    return {
      response: response.choices[0].message.content,
    };
  }
}
