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
  AssistantStreamResponse,
} from "../interfaces/ILanguageModel";
import { GenerationOptions, Message } from "../../types/common";
import { ITool } from "../../tools/interfaces/ITool";
import debug from "debug";
import { LLMError } from "../errors/LLMError";
import { AssistantTool, FunctionTool } from "openai/resources/beta/assistants";
import { ToolError } from "../../tools/errors/ToolError";
import * as z from "zod";

const log = debug("llm:openai-assistant");

export class OpenAIAssistantLanguageModel
  implements ILanguageModel<OpenAIAssistantLanguageModelConfig>
{
  private client: OpenAI;
  private threadId: string | null = null;
  private assistant: OpenAI.Beta.Assistants.Assistant | null = null;

  constructor(private config: OpenAIAssistantLanguageModelConfig) {
    this.client = new OpenAI({
      apiKey: this.config.providerApiKey,
    });
    log("Initialized OpenAI Assistant client");
  }

  private convertToolToAssistantTool(tool: ITool): FunctionTool {
    const zodSchema = tool.getParameters() as z.ZodObject<any>;

    // Convert Zod schema to OpenAI's expected JSON Schema format
    const parameters = {
      type: "object",
      properties: {} as Record<string, any>,
      required: [] as string[],
    };

    // Get the shape of the Zod schema
    const shape = zodSchema.shape;

    // Convert each property
    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodTypeAny;

      if (zodValue instanceof z.ZodEnum) {
        parameters.properties[key] = {
          type: "string",
          enum: zodValue.options,
          description: zodValue.description || undefined,
        };
      } else if (zodValue instanceof z.ZodNumber) {
        parameters.properties[key] = {
          type: "number",
          description: zodValue.description || undefined,
        };
      } else if (zodValue instanceof z.ZodString) {
        parameters.properties[key] = {
          type: "string",
          description: zodValue.description || undefined,
        };
      } else if (zodValue instanceof z.ZodBoolean) {
        parameters.properties[key] = {
          type: "boolean",
          description: zodValue.description || undefined,
        };
      } else if (zodValue instanceof z.ZodArray) {
        parameters.properties[key] = {
          type: "array",
          items: this.getZodTypeSchema(zodValue.element),
          description: zodValue.description || undefined,
        };
      }

      // Add to required array if the field is required
      if (!zodValue._def.isOptional) {
        parameters.required.push(key);
      }
    }

    log("Converted tool schema:", parameters);

    return {
      type: "function",
      function: {
        name: tool.getName(),
        description: tool.getDescription(),
        parameters: parameters,
      },
    };
  }

  // Helper method to get schema for nested types
  private getZodTypeSchema(zodType: z.ZodTypeAny): any {
    if (zodType instanceof z.ZodString) {
      return { type: "string" };
    } else if (zodType instanceof z.ZodNumber) {
      return { type: "number" };
    } else if (zodType instanceof z.ZodBoolean) {
      return { type: "boolean" };
    } else if (zodType instanceof z.ZodEnum) {
      return {
        type: "string",
        enum: zodType.options,
      };
    }
    // Add more types as needed
    return { type: "string" }; // fallback
  }

  private async initializeAssistant(tools?: ITool[]) {
    if (this.assistant) {
      log("Assistant already initialized");
      log("Assistant ID:", this.assistant?.id);
      log("Assistant Object:", this.assistant);
      return;
    }

    const startTime = performance.now();
    log("Starting assistant initialization...");

    const assistantTools: AssistantTool[] =
      tools?.map((tool) => this.convertToolToAssistantTool(tool)) ?? [];

    const assistantConfig = {
      model: this.config.model,
      tools: assistantTools,
      name: this.config.name,
      description: this.config.description,
      instructions: this.config.instructions,
    };

    try {
      if (this.config.assistantId) {
        log("Updating existing assistant:", this.config.assistantId);
        this.assistant = await this.client.beta.assistants.update(
          this.config.assistantId,
          assistantConfig
        );
      } else {
        log("Creating new assistant...");
        this.assistant = await this.client.beta.assistants.create(
          assistantConfig
        );
        log("Created new assistant with ID:", this.assistant.id);
        console.log("\n=== IMPORTANT: Save this Assistant ID ===");
        console.log("Assistant ID:", this.assistant.id);
        console.log("==========================================\n");
      }

      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // Convert to seconds
      log(
        `Assistant initialization completed in ${duration.toFixed(2)} seconds`
      );
      console.log(
        `Assistant initialization took ${duration.toFixed(2)} seconds`
      );
    } catch (error) {
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      log(
        `Assistant initialization failed after ${duration.toFixed(2)} seconds`
      );
      throw new LLMError("Failed to initialize OpenAI Assistant", {
        cause: error,
      });
    }
  }

  async generateText(
    messages: Message[],
    options: GenerationOptions & { tools?: ITool[] }
  ): Promise<GenerationResponse> {
    // Implementation for non-streaming response
    throw new Error(
      "OpenAI Assistant Agents currently only support streaming responses"
    );
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
  ): Promise<AssistantStreamResponse> {
    // Temporary, until we have a way to update the assistants seperately
    await this.initializeAssistant(options.tools);

    let assistantId = undefined;
    if (!this.config.assistantId) {
      throw new LLMError("Assistant ID is required to stream text");
    } else {
      assistantId = this.config.assistantId;
    }
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
              assistant_id: assistantId,
            }
          );

          // Forward the stream and get the run result
          let runResult = await forwardStream(runStream);

          // Handle any required actions (tool calls) in a loop
          while (
            runResult?.status === "requires_action" &&
            runResult.required_action?.type === "submit_tool_outputs"
          ) {
            const toolCalls =
              runResult.required_action.submit_tool_outputs.tool_calls;

            const toolOutputs = await Promise.all(
              toolCalls.map(async (toolCall) => {
                if (toolCall.type !== "function") {
                  throw new ToolError(
                    `Unsupported tool call type: ${toolCall.type}`
                  );
                }

                const tool = options.tools?.find(
                  (t) => t.getName() === toolCall.function.name
                );

                if (!tool) {
                  throw new ToolError(
                    `Tool ${toolCall.function.name} not found`
                  );
                }

                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  const result = await tool.execute(args);

                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(result),
                  };
                } catch (error) {
                  throw new LLMError(
                    `Failed to execute tool ${toolCall.function.name}`,
                    {
                      cause: error,
                    }
                  );
                }
              })
            );

            runResult = await forwardStream(
              this.client.beta.threads.runs.submitToolOutputsStream(
                this.threadId!,
                runResult.id,
                { tool_outputs: toolOutputs }
              )
            );
          }
        }
      );
    } catch (error) {
      const llmError = new LLMError("Failed to stream from Assistant API", {
        cause: error,
      });
      console.error(llmError.message, llmError.cause);
      throw llmError;
    }
  }
}
