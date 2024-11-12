import { ErrorOptions } from "../../types/errors";

export class LLMError extends Error {
  public readonly cause?: Error;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = "LLMError";
    this.cause = options?.cause as Error;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}
