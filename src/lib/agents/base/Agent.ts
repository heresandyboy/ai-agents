import {
  ILanguageModel,
  GenerationResponse,
  StreamingResponse,
  LanguageModelConfig,
  PortkeyLanguageModelConfig,
  OpenAIAssistantLanguageModelConfig,
  PortkeyStreamResponse,
  AssistantStreamResponse,
} from "../../llm/interfaces/ILanguageModel";
import { ITool, IToolRegistry } from "../../tools/interfaces/ITool";
import { Message, GenerationOptions } from "../../types/common";
import { ResponseHandlerFactory } from "../responses/ResponseHandler";
import { AgentError } from "../errors/AgentError";
import debug from "debug";
import { AssistantResponse, CoreTool } from "ai";
import { StreamTextResult } from "ai";

const log = debug("agent:main");

export interface AgentConfig {
  name: string;
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

  public async process(
    input: string,
    options: GenerationOptions = {}
  ): Promise<string | AgentResponseType<TConfig>> {
    log(`Processing input: "${input}"`);
    const messages = this.prepareMessages(input);
    const tools = Array.from(this.toolRegistry.getTools().values());

    try {
      const response = options.stream
        ? await this.handleStreamGeneration(messages, tools)
        : await this.handleCompleteGeneration(messages, tools);
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
    tools: ITool[]
  ): Promise<string> {
    const response = await this.languageModel.generateText(messages, {
      tools,
      maxSteps: this.config.maxSteps,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    const responseHandler = ResponseHandlerFactory.createHandler();
    return responseHandler.handleResponse(response);
  }

  private async handleStreamGeneration(
    messages: Message[],
    tools: ITool[]
  ): Promise<AgentResponseType<TConfig>> {
    return await this.languageModel.streamText(messages, {
      tools,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });
  }

  private updateMessageHistory(
    input: string,
    response: string | AgentResponseType<TConfig>
  ): void {
    this.messageHistory.push({ role: "user", content: input });
    if (typeof response === "string") {
      this.messageHistory.push({
        role: "assistant",
        content: response,
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
}
