export type MessageRole = "system" | "user" | "assistant" | "function";

export type LanguageModelV1FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other"
  | "unknown";

export interface Message {
  id?: string;
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
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
}
