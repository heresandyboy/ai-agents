// src/lib/tools/base/BaseTool.ts

import { CoreTool, tool } from "ai";
import { z } from "zod";

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

export abstract class BaseTool<P extends z.ZodTypeAny, R = unknown> {
  protected vercelTool: CoreTool<P, R>;

  constructor(
    protected readonly metadata: ToolMetadata,
    protected readonly parametersSchema: P
  ) {
    this.vercelTool = tool({
      description: metadata.description,
      parameters: this.parametersSchema,
      execute: this.execute.bind(this),
    });
  }

  protected abstract execute(
    params: z.infer<P>,
    options: { abortSignal?: AbortSignal }
  ): PromiseLike<R>;

  public getVercelTool() {
    return this.vercelTool;
  }

  public getMetadata() {
    return this.metadata;
  }
}
