// src/lib/tools/base/BaseTool.ts
import { tool } from "ai";
import { z } from "zod";
import { ToolMetadata } from "../types/tool";

export abstract class BaseTool {
  protected vercelTool: ReturnType<typeof tool>;

  constructor(
    protected readonly metadata: ToolMetadata,
    protected readonly parametersSchema: z.ZodTypeAny
  ) {
    this.vercelTool = tool({
      name: metadata.name,
      description: metadata.description,
      parameters: this.parametersSchema,
      execute: this.execute.bind(this),
    });
  }

  // Abstract method for execution
  protected abstract execute(
    params: z.infer<typeof this.parametersSchema>
  ): Promise<any>;

  // Getter for the Vercel AI SDK tool instance
  public getVercelTool() {
    return this.vercelTool;
  }

  // Getter for tool metadata
  public getMetadata() {
    return this.metadata;
  }
}
