import { z } from "zod";
import { type ITool, type ToolMetadata } from "../interfaces/ITool";
import debug from "debug";
import { ToolError } from "../errors/ToolError";

const log = debug("tools:base");

export abstract class Tool<P extends z.ZodTypeAny, R = unknown>
  implements ITool<z.infer<P>, R>
{
  constructor(
    protected readonly metadata: ToolMetadata,
    protected readonly schema: P
  ) {
    log(`Initializing tool: ${metadata.name}`);
  }

  getName(): string {
    return this.metadata.name;
  }

  getDescription(): string {
    return this.metadata.description;
  }

  getMetadata(): ToolMetadata {
    return this.metadata;
  }

  getParameters(): z.ZodTypeAny {
    return this.schema;
  }

  protected validateParams(params: unknown): z.infer<P> {
    try {
      return this.schema.parse(params);
    } catch (error) {
      log(`Parameter validation failed for ${this.getName()}:`, error);
      throw new ToolError(`Invalid parameters for ${this.getName()}`, {
        cause: error,
      });
    }
  }

  async execute(params: unknown): Promise<R> {
    const validatedParams = this.validateParams(params);
    try {
      return await this.executeValidated(validatedParams);
    } catch (error) {
      log(`Execution failed for ${this.getName()}:`, error);
      throw new ToolError(`${this.getName()} execution failed`, {
        cause: error,
      });
    }
  }

  protected abstract executeValidated(params: z.infer<P>): Promise<R>;
}
