import { AssistantResponse, CoreTool, StreamTextResult } from "ai";
import { ITool } from "../../tools/interfaces/ITool";
import {
  Message,
  GenerationOptions,
  LanguageModelV1FinishReason,
  ToolCall,
  ToolResult,
} from "../../types/common";
// import { ITool } from "../../tools/interfaces/ITool";

export interface GenerationStep {
  text: string;
  finishReason: LanguageModelV1FinishReason;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface GenerationResponse {
  text: string;
  finishReason: LanguageModelV1FinishReason;
  steps?: GenerationStep[];
}

// Define specific stream response types
export type PortkeyStreamResponse = StreamTextResult<
  Record<string, CoreTool<any, any>>
>;
export type AssistantStreamResponse = Response;

// Union type for all possible streaming responses
export type StreamingResponse = PortkeyStreamResponse | AssistantStreamResponse;

// Base config with common properties
interface BaseLanguageModelConfig {
  providerApiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Portkey specific config
export interface PortkeyLanguageModelConfig extends BaseLanguageModelConfig {
  llmRouterProvider: "portkey";
  llmProvider: "openai" | "anthropic" | "mistral";
  routerApiKey?: string;
}

// OpenAI Assistant specific config
export interface OpenAIAssistantLanguageModelConfig
  extends BaseLanguageModelConfig {
  llmRouterProvider: "openai-assistant";
  assistantId: string;
}

// Union type for all possible configs
export type LanguageModelConfig =
  | PortkeyLanguageModelConfig
  | OpenAIAssistantLanguageModelConfig;

// Map config types to their corresponding stream response types
export type ConfigToStreamResponse<T extends LanguageModelConfig> =
  T extends PortkeyLanguageModelConfig
    ? PortkeyStreamResponse
    : T extends OpenAIAssistantLanguageModelConfig
    ? AssistantStreamResponse
    : never;

// Make ILanguageModel generic with config type only
export interface ILanguageModel<
  TConfig extends LanguageModelConfig = LanguageModelConfig
> {
  generateText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<GenerationResponse>;

  streamText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<
    TConfig extends PortkeyLanguageModelConfig
      ? PortkeyStreamResponse
      : TConfig extends OpenAIAssistantLanguageModelConfig
      ? AssistantStreamResponse
      : never
  >;
}
