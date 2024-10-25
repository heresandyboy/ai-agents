import { BaseAgent } from "./baseAgent";
import { AgentResponse, Context } from "../agent";
import { createPortkey } from "@portkey-ai/vercel-provider";
import { CoreTool, generateText, GenerateTextResult } from "ai";

export class LocalAgent extends BaseAgent {
  private portkey;

  constructor() {
    super("local-agent", [
      "general conversation",
      "creative writing",
      "analysis",
    ]);

    const portkeyConfig = {
      provider: "ollama",
      customHost: process.env.OLLAMA_HOST || "http://localhost:11434",
      override_params: {
        model: "llama2",
        temperature: 0.7,
        stream: true,
      },
    };

    this.portkey = createPortkey({
      config: portkeyConfig,
    });
  }

  async handleRequest(content: string, context: Context) {
    if (!this.portkey) {
      throw new Error("Portkey client not initialized");
    }

    try {
      const result = await generateText({
        model: this.portkey.chatModel("llama2"),
        messages: [{ role: "user", content }],
      });

      return result;
    } catch (error) {
      console.error("Error in LocalAgent handleRequest:", error);
      throw error;
    }
  }
}
