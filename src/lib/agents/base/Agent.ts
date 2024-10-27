// agent/agent.ts
import { createPortkey } from "@portkey-ai/vercel-provider";
import { generateText, CoreMessage } from "ai";
import { z } from "zod";
import { BaseTool } from "../../tools/base/BaseTool";

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  model: string;
  provider: "openai" | "anthropic" | "mistral";
  temperature?: number;
  maxTokens?: number;
}

// agent/types.ts
export type MessageRole = "system" | "user" | "assistant" | "function";

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface StreamingOptions {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: (completion: string) => void;
}

export type GenerationMode = "stream" | "complete";

export interface GenerationOptions {
  mode?: GenerationMode;
  streaming?: StreamingOptions;
}

export default class Agent {
  private tools: Map<string, BaseTool<z.ZodTypeAny, unknown>>;
  private llmClient: ReturnType<typeof createPortkey>;

  constructor(
    private readonly config: AgentConfig,
    tools: BaseTool<z.ZodTypeAny, unknown>[] = []
  ) {
    this.tools = new Map(tools.map((tool) => [tool.getMetadata().name, tool]));

    this.llmClient = createPortkey({
      apiKey: process.env.PORTKEY_API_KEY!,
      config: {
        provider: config.provider,
        api_key: process.env[`${config.provider.toUpperCase()}_API_KEY`]!,
        override_params: {
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        },
      },
    });
  }

  public addTool(tool: BaseTool<z.ZodTypeAny, unknown>) {
    this.tools.set(tool.getMetadata().name, tool);
  }

  public async process(input: string): Promise<string> {
    const messages = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: input },
    ];

    // Convert array of tools to a Record/object with tool names as keys
    const vercelTools = Object.fromEntries(
      Array.from(this.tools.values()).map((tool) => [
        tool.getMetadata().name,
        tool.getVercelTool(),
      ])
    );

    const response = await generateText({
      model: this.llmClient.chatModel(""),
      messages: messages as CoreMessage[],
      tools: vercelTools,
    });

    return response.text;
  }
}
