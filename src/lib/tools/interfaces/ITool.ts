export interface ToolMetadata {
  name: string;
  categories: string[];
  version: string;
  author?: string;
  description: string;
  requiresAuth: boolean;
  rateLimit?: {
    requests: number;
    period: "second" | "minute" | "hour";
  };
}

export interface ITool<P = unknown, R = unknown> {
  getName(): string;
  getDescription(): string;
  getMetadata(): ToolMetadata;
  getParameters(): unknown;
  execute(params: P): Promise<R>;
}

export interface IToolRegistry {
  register(tool: ITool): void;
  unregister(toolName: string): void;
  getTools(): Map<string, ITool>;
}
