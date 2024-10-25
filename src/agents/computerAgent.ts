import { BaseAgent } from "./baseAgent";
import { AgentResponse, Context } from "../agent";
import { createPortkey } from "@portkey-ai/gateway";

export class ComputerAgent extends BaseAgent {
  private portkey;

  constructor() {
    super("computer-agent", [
      "file operations",
      "code execution",
      "web browsing",
    ]);
    this.portkey = createPortkey({
      apiKey: "YOUR_PORTKEY_API_KEY",
      config: {
        provider: "anthropic",
        api_key: "YOUR_ANTHROPIC_API_KEY",
        override_params: { model: "claude-2" },
      },
    });
  }

  async handleRequest(
    content: string,
    context: Context
  ): Promise<AgentResponse> {
    const response = await this.portkey.chat.completions.create({
      messages: [{ role: "user", content }],
    });

    return {
      response: response.choices[0].message.content,
    };
  }
}
