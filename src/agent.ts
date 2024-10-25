import { Message } from "ai";

export interface Context {
  [key: string]: any;
}

export interface AgentResponse {
  text: string;
  toolCalls?: any[];
  toolResults?: any[];
  metadata?: any;
  handoffAgentName?: string;
  updatedContext?: Partial<Context>;
  reasoning?: string;
  messages?: Message[];
}

export interface Agent {
  name: string;
  capabilities: string[];
  handleRequest(content: string, context: Context): Promise<AgentResponse>;
}
