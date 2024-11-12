import { GenerationResponse } from "../../llm/interfaces/ILanguageModel";
import { LanguageModelV1FinishReason } from "../../types/common";
import debug from "debug";
import { AgentError } from "../errors/AgentError";

const log = debug("agent:response");

export interface IResponseHandler {
  handleResponse(response: GenerationResponse): string;
  setNext(handler: IResponseHandler): IResponseHandler;
}

abstract class BaseResponseHandler implements IResponseHandler {
  protected nextHandler: IResponseHandler | null = null;

  setNext(handler: IResponseHandler): IResponseHandler {
    this.nextHandler = handler;
    return handler;
  }

  abstract handleResponse(response: GenerationResponse): string;

  protected getNextHandler(response: GenerationResponse): string {
    if (this.nextHandler) {
      return this.nextHandler.handleResponse(response);
    }
    return this.getFallbackText(response);
  }

  protected getFallbackText(response: GenerationResponse): string {
    const lastStep = response.steps?.[response.steps.length - 1];
    return response.text || lastStep?.text || "";
  }
}

class StepBasedResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): string {
    if (response.steps?.length) {
      const lastStep = response.steps[response.steps.length - 1];
      return lastStep.text || this.getNextHandler(response);
    }
    return this.getNextHandler(response);
  }
}

class ToolCallsResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): string {
    if (response.finishReason === "tool-calls") {
      log("Handling tool-calls finish reason");
      return this.getFallbackText(response);
    }
    return this.getNextHandler(response);
  }
}

class ContentFilterResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): string {
    if (response.finishReason === "content-filter") {
      log("Content filter triggered");
      throw new AgentError("Response filtered due to content policy");
    }
    return this.getNextHandler(response);
  }
}

class ErrorResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): string {
    if (response.finishReason === "error") {
      log("Error in text generation");
      throw new AgentError("Text generation failed");
    }
    return this.getNextHandler(response);
  }
}

export class ResponseHandlerFactory {
  static createHandler(): IResponseHandler {
    const stepHandler = new StepBasedResponseHandler();
    const toolCallsHandler = new ToolCallsResponseHandler();
    const contentFilterHandler = new ContentFilterResponseHandler();
    const errorHandler = new ErrorResponseHandler();

    stepHandler
      .setNext(toolCallsHandler)
      .setNext(contentFilterHandler)
      .setNext(errorHandler);

    return stepHandler;
  }
}
