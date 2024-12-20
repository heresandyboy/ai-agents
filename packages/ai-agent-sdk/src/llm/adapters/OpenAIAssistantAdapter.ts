import {
  AssistantResponse,
  type Message as AIMessage,
} from "ai";
import debug from "debug";
import OpenAI from "openai";
import {
  type AssistantTool,
  type FunctionTool,
} from "openai/resources/beta/assistants";
import * as z from "zod";
import { ToolError } from "../../tools/errors/ToolError";
import { type ITool } from "../../tools/interfaces/ITool";
import { type GenerationOptions, type Message } from "../../types/common";
import { LLMError } from "../errors/LLMError";
import {
  type AssistantStreamResponse,
  type GenerationResponse,
  type ILanguageModel,
  type OpenAIAssistantLanguageModelConfig
} from "../interfaces/ILanguageModel";

const log = debug("llm:openai-assistant");

export class OpenAIAssistantLanguageModel
  implements ILanguageModel<OpenAIAssistantLanguageModelConfig> {
  private client: OpenAI;
  private threadId: string | null = null;
  private assistant: OpenAI.Beta.Assistants.Assistant | null = null;
  private tools: ITool[] | undefined;

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
    await this.initializeAssistant(options.tools);
    this.tools = options.tools;

    if (!this.config.assistantId) {
      throw new LLMError("Assistant ID is required to stream text");
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
      const createdMessage = await this.client.beta.threads.messages.create(
        this.threadId,
        {
          role: "user",
          content: lastMessage?.content as string,
        }
      );

      return AssistantResponse(
        { threadId: this.threadId, messageId: createdMessage.id },
        async ({ forwardStream, sendDataMessage }) => {
          log('Creating AssistantResponse with metadata:', {
            threadId: this.threadId,
            messageId: createdMessage.id
          });

          const runStream = await this.client.beta.threads.runs.stream(
            this.threadId!,
            {
              assistant_id: this.config.assistantId!,
              stream: true,
            }
          );

          // Forward the stream immediately
          forwardStream(runStream);

          const toolResults = new Map<string, any>();

          // Set up proper event handlers for text streaming
          runStream.on('textCreated', (text) => {
            log('Text created:', text);
            const messageId = runStream.currentMessageSnapshot()?.id;
            if (messageId && text.value) {
              sendDataMessage({
                role: 'data',
                data: JSON.parse(JSON.stringify({
                  type: 'text-delta',
                  id: messageId,
                  content: {
                    textDelta: text.value
                  },
                  timestamp: Date.now()
                }))
              });
            }
          });

          runStream.on('textDelta', (delta, snapshot) => {
            log('Text delta received:', { delta, snapshot });
            const messageId = runStream.currentMessageSnapshot()?.id;
            if (messageId && delta.value) {
              sendDataMessage({
                role: 'data',
                data: JSON.parse(JSON.stringify({
                  type: 'text-delta',
                  id: messageId,
                  content: {
                    textDelta: delta.value
                  },
                  timestamp: Date.now()
                }))
              });
            }
          });

          // Tool call handling
          runStream.on('toolCallCreated', (toolCall) => {
            log('Tool call created:', toolCall);
            const stepId = runStream.currentRunStepSnapshot()?.id;
            if (toolCall.type === 'function' && stepId) {
              sendDataMessage({
                role: 'data',
                data: JSON.parse(JSON.stringify({
                  type: 'tool-call',
                  id: stepId,
                  content: {
                    toolCallId: toolCall.id,
                    toolName: toolCall.function.name,
                    args: toolCall.function.arguments
                  },
                  timestamp: Date.now()
                }))
              });
            }
          });

          runStream.on('toolCallDone', async (toolCall) => {
            log('Tool call completed:', toolCall);
            const stepId = runStream.currentRunStepSnapshot()?.id;
            if (toolCall.type === 'function' && stepId) {
              try {
                const tool = this.tools?.find(t => t.getName() === toolCall.function.name);
                if (!tool) {
                  throw new ToolError(`Tool ${toolCall.function.name} not found`);
                }

                const args = JSON.parse(toolCall.function.arguments || '{}');
                const result = await tool.execute(args);
                const serializedResult = JSON.parse(JSON.stringify(result));
                toolResults.set(toolCall.id, serializedResult);

                sendDataMessage({
                  role: 'data',
                  data: JSON.parse(JSON.stringify({
                    type: 'tool-result',
                    id: stepId,
                    content: {
                      toolCallId: toolCall.id,
                      toolName: toolCall.function.name,
                      args,
                      result: serializedResult
                    },
                    timestamp: Date.now()
                  }))
                });

                // Submit the tool outputs
                await this.client.beta.threads.runs.submitToolOutputs(
                  this.threadId!,
                  runStream.currentRun()!.id,
                  {
                    tool_outputs: [{
                      tool_call_id: toolCall.id,
                      output: JSON.stringify(serializedResult)
                    }]
                  }
                );
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                throw new ToolError(`Failed to execute tool ${toolCall.function.name}: ${errorMessage}`);
              }
            }
          });

          // Handle stream completion
          runStream.on('end', () => {
            sendDataMessage({
              role: 'data',
              data: JSON.parse(JSON.stringify({
                type: 'finish',
                timestamp: Date.now()
              }))
            });
          });

          // Return a Promise that resolves when the stream ends or errors
          return new Promise<void>((resolve, reject) => {
            runStream.on('end', resolve);
            runStream.on('error', reject);
          });
        }
      );
    } catch (error) {
      log('Error in streamText:', error);
      throw new LLMError(`Failed to stream text: ${error}`);
    }
  }
}
