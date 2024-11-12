import {
  ILanguageModel,
  GenerationResponse,
  StreamingResponse,
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
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
}

export class Agent {
  private messageHistory: Message[] = [];

  constructor(
    private readonly config: AgentConfig,
    private readonly languageModel: ILanguageModel,
    private readonly toolRegistry: IToolRegistry
  ) {
    log("Initializing agent:", config.name);
  }

  public async process(
    input: string,
    options: GenerationOptions = {}
  ): Promise<string | StreamingResponse> {
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
    const messages = [
      { role: "system", content: this.config.systemPrompt },
      ...this.messageHistory,
      { role: "user", content: input },
    ];
    log("Prepared messages for LLM");
    return messages as Message[];
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
  ): Promise<StreamingResponse> {
    return await this.languageModel.streamText(messages, {
      tools,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });
  }

  private updateMessageHistory(
    input: string,
    response: string | StreamingResponse
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
