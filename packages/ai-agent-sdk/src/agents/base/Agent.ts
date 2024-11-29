import {
  type ILanguageModel,
  type GenerationResponse,
  // type StreamingResponse,
  type LanguageModelConfig,
  type PortkeyLanguageModelConfig,
  type OpenAIAssistantLanguageModelConfig,
  type PortkeyStreamResponse,
  type AssistantStreamResponse,
} from "../../llm/interfaces/ILanguageModel";
import { type ITool, type IToolRegistry } from "../../tools/interfaces/ITool";
import { type Message, type GenerationOptions } from "../../types/common";
import { ResponseHandlerFactory } from "../responses/ResponseHandler";
import { AgentError } from "../errors/AgentError";
import debug from "debug";
// import { type AssistantResponse, type CoreTool } from "ai";
// import { type StreamTextResult } from "ai";

const log = debug("agent:main");

export interface AgentConfig {
  name: string;
  description: string;
  capabilities?: string[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
}

// Define a utility type for determining the response type
type AgentResponseType<TConfig> = TConfig extends PortkeyLanguageModelConfig
  ? PortkeyStreamResponse
  : TConfig extends OpenAIAssistantLanguageModelConfig
  ? AssistantStreamResponse
  : never;

export class Agent<TConfig extends LanguageModelConfig> {
  private messageHistory: Message[] = [];

  constructor(
    private readonly config: AgentConfig,
    private readonly languageModel: ILanguageModel<TConfig>,
    private readonly toolRegistry: IToolRegistry
  ) {
    log("Initializing agent:", config.name);
  }

  public getName(): string {
    return this.config.name;
  }

  public getDescription(): string {
    return this.config.description;
  }

  public getCapabilities(): string[] {
    return this.config.capabilities || [];
  }

  public async process(
    input: string,
    options: GenerationOptions = {}
  ): Promise<string | GenerationResponse | AgentResponseType<TConfig>> {
    log(`Processing input: "${input}"`);
    const messages = this.prepareMessages(input);
    const tools = Array.from(this.toolRegistry.getTools().values());

    try {
      const response = options.stream
        ? await this.handleStreamGeneration(messages, tools, options)
        : await this.handleCompleteGeneration(messages, tools, options);
      if (typeof response === "string") {
        this.updateMessageHistory(input, response);
      }
      log("Processing completed successfully");
      return response;
    } catch (error) {
      log("Error during processing:", error);
      throw new AgentError("Processing failed", { cause: error });
    }
  }

  public async processMessages(
    messages: Message[],
    options: GenerationOptions = {}
  ): Promise<string | GenerationResponse | AgentResponseType<TConfig>> {
    const tools = Array.from(this.toolRegistry.getTools().values());

    try {
      const response = options.stream
        ? await this.handleStreamGeneration(messages, tools, options)
        : await this.handleCompleteGeneration(messages, tools, options);
      return response;
    } catch (error) {
      throw new AgentError("Processing failed", { cause: error });
    }
  }

  private prepareMessages(input: string): Message[] {
    const messages: Message[] = [];

    if (this.config.systemPrompt) {
      messages.push({ role: "system", content: this.config.systemPrompt });
    }

    messages.push(...this.messageHistory, { role: "user", content: input });

    log("Prepared messages for LLM");
    return messages;
  }

  private async handleCompleteGeneration(
    messages: Message[],
    tools: ITool[],
    options: GenerationOptions
  ): Promise<string | GenerationResponse> {
    const response = await this.languageModel.generateText(messages, {
      tools,
      toolChoice: options.toolChoice,
      maxSteps: options.maxSteps ?? this.config.maxSteps,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    });

    const responseHandler = ResponseHandlerFactory.createHandler();
    console.warn("Response", JSON.stringify(response, null, 2));
    return responseHandler.handleResponse(response);
  }

  private async handleStreamGeneration(
    messages: Message[],
    tools: ITool[],
    options: GenerationOptions
  ): Promise<AgentResponseType<TConfig>> {
    return await this.languageModel.streamText(messages, {
      tools,
      toolChoice: options.toolChoice,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    });
  }

  private updateMessageHistory(
    input: string,
    response: string | GenerationResponse | AgentResponseType<TConfig>
  ): void {
    this.messageHistory.push({ role: "user", content: input });
    if (typeof response === "string") {
      this.messageHistory.push({
        role: "assistant",
        content: response,
      });
    } else if ("text" in response) {
      this.messageHistory.push({
        role: "assistant",
        content: response.text.toString(),
      });
    }
  }

  public clearHistory(): void {
    this.messageHistory = [];
    log("Message history cleared");
  }

  public getHistory(): Message[] {
    return [...this.messageHistory];
  }

  public setSystemPrompt(systemPrompt: string): void {
    this.config.systemPrompt = systemPrompt;
  }
}
