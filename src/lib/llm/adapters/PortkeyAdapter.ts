import { createPortkey } from "@portkey-ai/vercel-provider";
import {
  generateText,
  streamText,
  CoreMessage,
  CoreTool,
  StreamTextResult,
} from "ai";
import {
  ILanguageModel,
  GenerationResponse,
  LanguageModelConfig,
  PortkeyLanguageModelConfig,
  PortkeyStreamResponse,
} from "../interfaces/ILanguageModel";
import { Message, GenerationOptions } from "../../types/common";
import { ITool } from "../../tools/interfaces/ITool";
import debug from "debug";
import { LLMError } from "../errors/LLMError";

const log = debug("llm:portkey");

export class PortkeyLanguageModel
  implements ILanguageModel<PortkeyLanguageModelConfig>
{
  private client: ReturnType<typeof createPortkey>;

  constructor(private config: PortkeyLanguageModelConfig) {
    this.client = this.initializeClient();
    log("Initialized Portkey client with config:", {
      provider: config.llmProvider,
      model: config.model,
    });
  }

  private initializeClient() {
    return createPortkey({
      apiKey: this.config.routerApiKey ?? "api_key",
      config: {
        provider: this.config.llmProvider,
        api_key: this.config.providerApiKey,
        override_params: {
          model: this.config.model,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
      },
    });
  }

  private convertMessages(messages: Message[]): CoreMessage[] {
    return messages.map(
      (msg) =>
        ({
          role: msg.role,
          content: msg.content,
          name: msg.name,
          function_call: msg.function_call,
        } as CoreMessage)
    );
  }

  private convertToolsToVercelFormat(
    tools?: ITool[]
  ): Record<string, CoreTool<any, any>> {
    if (!tools?.length) return {};

    return Object.fromEntries(
      tools.map((tool) => [
        tool.getName(),
        {
          description: tool.getDescription(),
          parameters: tool.getParameters(),
          execute: tool.execute.bind(tool),
        },
      ])
    );
  }

  private convertResponse(response: any): GenerationResponse {
    return {
      text: response.text,
      finishReason: response.finishReason,
      steps: response.steps?.map((step: any) => ({
        text: step.text,
        finishReason: step.finishReason,
        toolCalls: step.toolCalls,
        toolResults: step.toolResults,
      })),
    };
  }

  async generateText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<GenerationResponse> {
    log("Generating text with options:", options);

    const vercelTools = this.convertToolsToVercelFormat(options.tools);
    const convertedMessages = this.convertMessages(messages);

    try {
      const response = await generateText({
        model: this.client.chatModel(""),
        messages: convertedMessages,
        tools: vercelTools,
        maxSteps: options.maxSteps ?? 5,
        temperature: options.temperature ?? this.config.temperature,
        maxTokens: options.maxTokens ?? this.config.maxTokens,
        experimental_telemetry: { isEnabled: true },
        onStepFinish: (step) => {
          log("Step completed:", {
            finishReason: step.finishReason,
            hasToolCalls: !!step.toolCalls?.length,
          });
        },
      });

      return this.convertResponse(response);
    } catch (error) {
      const llmError = new LLMError("Failed to generate text", {
        cause: error,
      });
      console.error(llmError.message, llmError.cause);
      throw llmError;
    }
  }

  async streamText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<PortkeyStreamResponse> {
    log("Streaming text with options:", options);

    const vercelTools = this.convertToolsToVercelFormat(options.tools);
    const convertedMessages = this.convertMessages(messages);

    try {
      const response = await streamText({
        model: this.client.chatModel(""),
        messages: convertedMessages,
        tools: vercelTools,
        maxSteps: options.maxSteps ?? 5,
        temperature: options.temperature ?? this.config.temperature,
        maxTokens: options.maxTokens ?? this.config.maxTokens,
        onChunk: (chunk) => {
          log("Stream chunk:", {
            text: chunk,
          });
        },
        onStepFinish: (step) => {
          log("Stream step finished:", {
            finishReason: step.finishReason,
            hasToolCalls: !!step.toolCalls?.length,
            text: step.text,
          });
        },
        onFinish: (response) => {
          log("Stream finished:", {
            finishReason: response.finishReason,
            hasToolCalls: !!response.toolCalls?.length,
            text: response.text,
          });
        },
      });
      return response;
      // return response.toDataStreamResponse();
      // return response.toTextStreamResponse();

      // return this.convertResponse(response);
    } catch (error) {
      const llmError = new LLMError("Failed to generate text", {
        cause: error,
      });
      console.error(llmError.message, llmError.cause);
      throw llmError;
    }
  }
}
