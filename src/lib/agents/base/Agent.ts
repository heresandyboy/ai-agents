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
import debug from "debug";

// Add logger initialization
const log = {
  agent: debug("agent:main"),
  tools: debug("agent:tools"),
  llm: debug("agent:llm"),
};

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
  private messageHistory: CoreMessage[] = []; // Store conversation history

  constructor(
    private readonly config: AgentConfig,
    tools: BaseTool<z.ZodTypeAny, unknown>[] = []
  ) {
    this.tools = new Map(tools.map((tool) => [tool.getMetadata().name, tool]));
    log.agent("Initializing agent with config:", config);
    log.tools("Registered tools:", Array.from(this.tools.keys()));

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
    log.agent("LLM client initialized");
  }

  public addTool(tool: BaseTool<z.ZodTypeAny, unknown>) {
    this.tools.set(tool.getMetadata().name, tool);
  }

  private prepareMessages(input: string): CoreMessage[] {
    const messages = [
      { role: "system", content: this.config.systemPrompt },
      ...this.messageHistory,
      { role: "user", content: input },
    ];
    log.llm("Prepared messages:", messages);
    return messages as CoreMessage[];
  }

  private prepareTools() {
    const tools = Object.fromEntries(
      Array.from(this.tools.values()).map((tool) => [
        tool.getMetadata().name,
        tool.getVercelTool(),
      ])
    );
    log.tools("Prepared tools for LLM:", Object.keys(tools));
    return tools as Record<string, CoreTool<any, any>>;
  }

  private async handleStreamGeneration(
    messages: CoreMessage[],
    tools: Record<string, CoreTool<any, any>>
  ) {
    log.llm("Starting stream generation");
    return await streamText({
      model: this.llmClient.chatModel(""),
      messages,
      tools,
      onFinish: ({ text }) => {
        log.llm("Stream completed, final text:", text);
        this.messageHistory.push({
          role: "assistant",
          content: text,
        });
      },
    });
  }

  private async handleCompleteGeneration(
    messages: CoreMessage[],
    tools: Record<string, CoreTool<any, any>>
  ): Promise<string> {
    log.llm("Starting complete generation");
    const response = await generateText({
      model: this.llmClient.chatModel(""),
      messages,
      tools,
    });
    log.llm("Generation completed:", response);
    return response.text;
  }

  public async process(
    input: string,
    options: GenerationOptions = {}
  ): Promise<string | StreamTextResult<typeof tools>> {
    log.agent(`Processing input: "${input}"`);
    const messages = this.prepareMessages(input);
    const tools = this.prepareTools();

    try {
      const response = options.stream
        ? await this.handleStreamGeneration(messages, tools)
        : await this.handleCompleteGeneration(messages, tools);

      this.messageHistory.push({ role: "user", content: input });
      if (!options.stream) {
        this.messageHistory.push({
          role: "assistant",
          content: response as string,
        });
      }

      log.agent("Processing completed successfully");
      return response;
    } catch (error) {
      log.agent("Error during processing:", error);
      throw error;
    }
  }

  // Add methods to manage history
  public clearHistory(): void {
    this.messageHistory = [];
  }

  public getHistory(): CoreMessage[] {
    return [...this.messageHistory];
  }
}
