import {
  AssistantResponse,
  Message as AIMessage,
  StreamTextResult,
  CoreTool,
} from "ai";
import OpenAI from "openai";
import {
  ILanguageModel,
  GenerationResponse,
  LanguageModelConfig,
  OpenAIAssistantLanguageModelConfig,
} from "../interfaces/ILanguageModel";
import { GenerationOptions, Message } from "../../types/common";
import { ITool } from "../../tools/interfaces/ITool";
import debug from "debug";
import { LLMError } from "../errors/LLMError";

const log = debug("llm:openai-assistant");

export class OpenAIAssistantLanguageModel implements ILanguageModel {
  private client: OpenAI;
  private threadId: string | null = null;

  constructor(private config: OpenAIAssistantLanguageModelConfig) {
    this.client = new OpenAI({
      apiKey: this.config.providerApiKey,
    });
    log("Initialized OpenAI Assistant client");
  }

  async generateText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<GenerationResponse> {
    // Implementation for non-streaming response
    throw new Error("OpenAI Assistants only support streaming responses");
  }

  private convertMessages(messages: Message[]): AIMessage[] {
    return messages.map((msg) => ({
      id: msg.id ?? "",
      role: msg.role,
      content: msg.content,
      name: msg.name,
      function_call: msg.function_call,
    }));
  }

  async streamText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<Response> {
    log("Streaming text with Assistant API");

    const convertedMessages = this.convertMessages(messages);
    const lastMessage = convertedMessages[convertedMessages.length - 1];

    try {
      // Create or reuse thread
      if (!this.threadId) {
        const thread = await this.client.beta.threads.create({});
        this.threadId = thread.id;
      }

      // Add the latest message to the thread
      await this.client.beta.threads.messages.create(this.threadId, {
        role: "user",
        content: lastMessage.content as string,
      });

      // Create AssistantResponse using Vercel's SDK
      return AssistantResponse(
        { threadId: this.threadId, messageId: lastMessage.id },
        async ({ forwardStream, sendDataMessage }) => {
          const runStream = this.client.beta.threads.runs.stream(
            this.threadId!,
            {
              assistant_id: this.config.assistantId,
            }
          );

          // Forward the stream and get the run result
          let runResult = await forwardStream(runStream);

          // Handle any required actions (tool calls) in a loop
          while (
            runResult?.status === "requires_action" &&
            runResult.required_action?.type === "submit_tool_outputs"
          ) {
            // Handle tool outputs here if needed
            runResult = await forwardStream(
              this.client.beta.threads.runs.submitToolOutputsStream(
                this.threadId!,
                runResult.id,
                { tool_outputs: [] } // Add your tool outputs here if needed
              )
            );
          }
        }
      ) as Response;
    } catch (error) {
      const llmError = new LLMError("Failed to stream from Assistant API", {
        cause: error,
      });
      console.error(llmError.message, llmError.cause);
      throw llmError;
    }
  }
}
