// agent/agent.ts
import { createPortkey } from "@portkey-ai/vercel-provider";
import {
  generateText,
  CoreMessage,
  streamText,
  CoreTool,
  StreamTextResult,
} from "ai";
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

export interface GenerationOptions {
  stream?: boolean;
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

  private prepareMessages(input: string): CoreMessage[] {
    return [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: input },
    ];
  }

  private prepareTools() {
    const tools = Object.fromEntries(
      Array.from(this.tools.values()).map((tool) => [
        tool.getMetadata().name,
        tool.getVercelTool(),
      ])
    );
    return tools as Record<string, CoreTool<any, any>>;
  }

  private async handleStreamGeneration(
    messages: CoreMessage[],
    tools: Record<string, CoreTool<any, any>>
  ) {
    return await streamText({
      model: this.llmClient.chatModel(""),
      messages,
      tools,
    });
  }

  private async handleCompleteGeneration(
    messages: CoreMessage[],
    tools: Record<string, CoreTool<any, any>>
  ): Promise<string> {
    const response = await generateText({
      model: this.llmClient.chatModel(""),
      messages,
      tools,
    });

    return response.text;
  }

  public async process(
    input: string,
    options: GenerationOptions = {}
  ): Promise<string | StreamTextResult<typeof tools>> {
    const messages = this.prepareMessages(input);
    const tools = this.prepareTools();

    return options.stream
      ? this.handleStreamGeneration(messages, tools)
      : this.handleCompleteGeneration(messages, tools);
  }
}
