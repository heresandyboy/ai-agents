import { ErrorOptions } from "../../types/errors";

export class AgentError extends Error {
  public readonly cause?: Error;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = "AgentError";

    this.cause = options?.cause as Error;
    Error.captureStackTrace(this, this.constructor);
  }
}
