import { BaseAgent } from "./baseAgent";
import { Context } from "../agent";
import { createPortkey } from "@portkey-ai/vercel-provider";
import { CoreTool, generateText, GenerateTextResult } from "ai";
import { computerTool } from "../tools/computer/computer.tool";
import { editorTool } from "../tools/editor/editor.tool";
import { bashTool } from "../tools/bash/bash.tool";
import { safeStringify } from "../utils/logging";

type ComputerTools = {
  computer: typeof computerTool;
  editor: typeof editorTool;
  bash: typeof bashTool;
};

export class ComputerAgent extends BaseAgent<ComputerTools> {
  private portkey;

  constructor() {
    super("computer-agent", [
      "file operations",
      "code execution",
      "web browsing",
    ]);

    const portkeyConfig = {
      provider: "anthropic",
      api_key: process.env.ANTHROPIC_API_KEY,
      override_params: {
        model: "claude-3-5-sonnet-20241022",
        temperature: 0.7,
        betas: ["computer-use-2024-10-22"],
        max_tokens: 1000,
      },
    };

    this.portkey = createPortkey({
      config: portkeyConfig,
    });
  }

  async handleRequest(content: string, context: Context) {
    console.log("\n🤖 ComputerAgent: Processing request");
    console.log("📝 Content:", content);
    console.log("🔍 Context:", safeStringify(context));

    if (!this.portkey) {
      throw new Error("Portkey client not initialized");
    }

    try {
      console.log("🔄 Generating text with AI model...");
      const result = await generateText({
        model: this.portkey.chatModel(""),
        messages: [{ role: "user", content }],
        tools: {
          computer: computerTool,
          editor: editorTool,
          bash: bashTool,
        },
      });

      console.log("✅ AI generation completed");
      console.log("📊 Result details:");
      console.log("- Text:", result.text);
      console.log("- Tool Calls:", safeStringify(result.toolCalls));
      console.log("- Tool Results:", safeStringify(result.toolResults));
      console.log("- Usage:", safeStringify(result.usage));
      console.log(
        "- Response Messages:",
        safeStringify(result.responseMessages)
      );

      return result;
    } catch (error) {
      console.error("❌ Error in ComputerAgent handleRequest:", error);
      throw error;
    }
  }
}
