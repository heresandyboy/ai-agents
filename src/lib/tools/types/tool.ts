// src/lib/tools/types/tool.ts
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
