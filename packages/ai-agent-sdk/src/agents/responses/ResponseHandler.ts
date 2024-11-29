import { type GenerationResponse } from "../../llm/interfaces/ILanguageModel";
// import { type LanguageModelV1FinishReason } from "../../types/common";
import debug from "debug";
import { AgentError } from "../errors/AgentError";

const log = debug("agent:response");

// Define a new type for the handler's return value
type ResponseResult = string | GenerationResponse;

export interface IResponseHandler {
  handleResponse(response: GenerationResponse): ResponseResult;
  setNext(handler: IResponseHandler): IResponseHandler;
}

abstract class BaseResponseHandler implements IResponseHandler {
  protected nextHandler: IResponseHandler | null = null;

  setNext(handler: IResponseHandler): IResponseHandler {
    this.nextHandler = handler;
    return handler;
  }

  abstract handleResponse(response: GenerationResponse): ResponseResult;

  protected getNextHandler(response: GenerationResponse): ResponseResult {
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

// Handles the case where response.text is empty but steps have text
class StepBasedResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): ResponseResult {
    if (
      response.steps?.length &&
      (!response.text || response.text.trim() === "")
    ) {
      const lastStep = response.steps[response.steps.length - 1];
      if (lastStep?.text) {
        return lastStep.text;
      }
    }
    return this.getNextHandler(response);
  }
}

// if we have tool calls return the entire response for later processing
class ToolCallsResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): ResponseResult {
    const hasToolCalls = response.steps?.some(
      (step) => step.toolCalls && step.toolCalls.length > 0
    );
    if (hasToolCalls) {
      log("Handling response with tool calls");
      // Return the entire GenerationResponse for further processing
      return response;
    }
    return this.getNextHandler(response);
  }
}

class ContentFilterResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): ResponseResult {
    if (response.finishReason === "content-filter") {
      log("Content filter triggered");
      throw new AgentError("Response filtered due to content policy");
    }
    return this.getNextHandler(response);
  }
}

class ErrorResponseHandler extends BaseResponseHandler {
  handleResponse(response: GenerationResponse): ResponseResult {
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
