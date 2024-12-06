export type MessageRole = "system" | "user" | "assistant" | "data"

// TODO: Need to somehow link this to the ai package Message Roles so I dont need ot update it all the time

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
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "tool"; toolName: string };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
}
