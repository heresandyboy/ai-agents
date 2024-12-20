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
          log('Created runStream:', { type: typeof runStream });

          // Forward the stream and handle cleanup
          const streamPromise = forwardStream(runStream);
          log('Forwarded stream to client');

          runStream.on('event', async (event) => {
            const timestamp = Date.now();
            log('Received OpenAI event:', {
              event: event.event,
              data: event.data,
              type: typeof event
            });

            switch (event.event) {
              case 'thread.message.created':
                log('Message created event received', { data: event.data });
                sendDataMessage({
                  role: 'data',
                  data: {
                    type: 'status',
                    status: 'Processing message...',
                    timestamp
                  }
                });
                break;

              case 'thread.message.delta':
                log('Message delta event received', { delta: event.data.delta });
                const deltaContent = event.data.delta.content?.[0];
                if (deltaContent && 'type' in deltaContent && deltaContent.type === 'text') {
                  const textDelta = ('text' in deltaContent && deltaContent.text?.value) || '';
                  if (textDelta) {
                    log('Received text delta', { text: textDelta });
                    sendDataMessage({
                      role: 'data',
                      data: {
                        type: 'text-delta',
                        id: event.data.id,
                        content: {
                          textDelta
                        },
                        timestamp
                      }
                    });
                  }
                }
                break;

              case 'thread.run.queued':
                log('Run queued event received');
                sendDataMessage({
                  role: 'data',
                  data: {
                    type: 'status',
                    status: 'Assistant initialized...',
                    timestamp
                  }
                });
                break;

              case 'thread.run.in_progress':
                log('Run in progress event received', { data: event.data });
                sendDataMessage({
                  role: 'data',
                  data: {
                    type: 'status',
                    status: 'Processing request...',
                    timestamp
                  }
                });
                break;

              case 'thread.run.requires_action':
                log('Run requires action event received', {
                  toolCalls: event.data.required_action?.submit_tool_outputs?.tool_calls,
                });

                if (!event.data.required_action?.submit_tool_outputs?.tool_calls) {
                  throw new Error('No tool calls found in required action');
                }

                const toolResults = new Map<string, any>();

                // Execute each tool call
                for (const toolCall of event.data.required_action.submit_tool_outputs.tool_calls) {
                  // Send tool call event
                  sendDataMessage({
                    role: 'data',
                    data: {
                      type: 'tool-call',
                      id: event.data.id,
                      content: {
                        toolCallId: toolCall.id,
                        toolName: toolCall.function.name,
                        args: toolCall.function.arguments
                      },
                      timestamp
                    }
                  });

                  const tool = this.tools?.find(t => t.getName() === toolCall.function.name);
                  if (!tool) {
                    throw new ToolError(`Tool ${toolCall.function.name} not found`);
                  }

                  try {
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    log('Executing tool', { toolName: toolCall.function.name, args });
                    const result = await tool.execute(args);
                    log('Tool execution result', { toolName: toolCall.function.name, result });

                    const serializedResult = JSON.parse(JSON.stringify(result));
                    log('Serialized result', { toolName: toolCall.function.name, serializedResult });
                    toolResults.set(toolCall.id, serializedResult);

                    sendDataMessage({
                      role: 'data',
                      data: {
                        type: 'tool-result',
                        id: event.data.id,
                        content: {
                          toolCallId: toolCall.id,
                          toolName: toolCall.function.name,
                          args,
                          result: serializedResult
                        },
                        timestamp
                      }
                    });
                  } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    throw new ToolError(`Failed to execute tool ${toolCall.function.name}: ${errorMessage}`);
                  }
                }

                // Submit all tool outputs together
                if (!event.data.required_action?.submit_tool_outputs?.tool_calls) {
                  throw new Error('No tool calls found when submitting outputs');
                }

                const toolOutputs = event.data.required_action.submit_tool_outputs.tool_calls.map(
                  toolCall => ({
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(toolResults.get(toolCall.id))
                  })
                );
                log('Submitting tool outputs', { toolOutputs });
                await this.client.beta.threads.runs.submitToolOutputs(
                  this.threadId!,
                  event.data.id,
                  { tool_outputs: toolOutputs }
                );
                log('Tool outputs submitted, waiting for response');
                break;

              case 'thread.run.completed':
                log('Run completed event received');
                // Wait for stream completion
                await runStream.done();
                break;

              case 'error':
                log('Error event received', { error: event.data });
                // Handle error and abort
                runStream._emit('error', new Error(`Assistant error: ${event.data.message}`));
                throw new Error(`Assistant error: ${event.data.message}`);
            }
          });

          // Wait for the stream to complete
          await streamPromise;
          log('Stream completed');

          // Get the final message if we haven't received it through deltas
          const messages = await this.client.beta.threads.messages.list(this.threadId!);
          const lastMessage = messages.data[0];
          if (lastMessage?.content?.[0]?.type === 'text' && 'text' in lastMessage.content[0]) {
            const text = lastMessage.content[0].text.value;
            log('Sending final text response', { text });
            sendDataMessage({
              role: 'data',
              data: {
                type: 'text-delta',
                id: lastMessage.id,
                content: {
                  textDelta: text
                },
                timestamp: Date.now()
              }
            });
          }

          // Send finish event
          sendDataMessage({
            role: 'data',
            data: {
              type: 'finish',
              timestamp: Date.now()
            }
          });
          log('Sent finish event');
        }
      );
    } catch (error) {
      throw new LLMError("Failed to stream from Assistant API", {
        cause: error,
      });
    }
  }
}
