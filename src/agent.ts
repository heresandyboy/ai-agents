export interface Context {
  [key: string]: any;
}

export interface AgentResponse {
  response: string;
  handoffAgentName?: string;
  updatedContext?: Partial<Context>;
  reasoning?: string;
}

export interface Agent {
  name: string;
  capabilities: string[];
  handleRequest(content: string, context: Context): Promise<AgentResponse>;
}

