export interface AgentConfig {
  name: string;
  systemPrompt: string;
  model: string;
  provider: "openai" | "anthropic" | "mistral";
  temperature?: number;
  maxTokens?: number;
}
