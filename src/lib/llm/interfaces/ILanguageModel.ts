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

export type StreamingResponse =
  | StreamTextResult<Record<string, CoreTool<any, any>>> // For Portkey and other providers
  | Response; // For OpenAI Assistants API

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

export interface ILanguageModel {
  generateText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<GenerationResponse>;

  streamText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<StreamingResponse>;
}
