// src/agents/computerAgent.ts
import { BaseAgent } from "./baseAgent";
import { Context } from "../agent";
import { createPortkey } from "@portkey-ai/vercel-provider";
import { CoreTool, GenerateTextResult } from "ai";
import { computerTool } from "../tools/computer/computer.tool";
import { editorTool } from "../tools/editor/editor.tool";
import { bashTool } from "../tools/bash/bash.tool";
import { samplingLoop } from "../utils/samplingLoop";

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

  getModel() {
    return this.portkey.chatModel("");
  }

  getTools(): ComputerTools {
    return {
      computer: computerTool,
      editor: editorTool,
      bash: bashTool,
    };
  }

  async executeTool(
    toolName: keyof ComputerTools, // Change string to keyof ComputerTools
    args: any
  ): Promise<{ result: string; base64Image?: string }> {
    const tools = this.getTools();

    if (toolName in tools) {
      const toolResult = await tools[toolName].execute(args, {
        abortSignal: undefined,
      });
      return toolResult;
    } else {
      throw new Error(`Tool ${toolName} not found`);
    }
  }

  async handleRequest(content: string, context: Context) {
    console.log("\n🤖 ComputerAgent: Processing request");
    console.log("📝 Content:", content);
    console.log("🔍 Context:", context);

    try {
      console.log("🔄 Starting sampling loop...");
      const result = await samplingLoop<ComputerTools>({
        content,
        context,
        agent: this,
      });

      console.log("\n✅ Sampling loop completed");
      console.log("📊 Result details:");
      console.log("- Text:", result.text);
      console.log("- Tool Calls:", result.toolCalls);
      console.log("- Tool Results:", result.toolResults);

      return result;
    } catch (error) {
      console.error("❌ Error in ComputerAgent handleRequest:", error);
      throw error;
    }
  }
}
