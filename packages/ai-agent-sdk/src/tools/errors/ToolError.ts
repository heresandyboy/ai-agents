import { type ErrorOptions } from "../../types/errors";

export class ToolError extends Error {
  public readonly cause?: Error;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = "ToolError";

    this.cause = options?.cause as Error;
    Error.captureStackTrace(this, this.constructor);
  }
}
