import {
  Agent,
  AgentClassifier,
  AgentOrchestrator,
  LanguageModelFactory,
  ToolRegistry,
  type Message,
  type OpenAIAssistantLanguageModelConfig,
  type PortkeyLanguageModelConfig,
  type PortkeyStreamResponse,
} from "@zen/ai-agent-sdk";
import { type NextRequest } from "next/server";

// Import specific tools from the tools subpath
import { CalculatorTool, WeatherTool } from "@zen/ai-agent-sdk/tools";

import { StreamData } from 'ai';

export const runtime = "edge";

// Configure the language model
const agentLanguageModelConfig: PortkeyLanguageModelConfig = {
  llmRouterProvider: "portkey",
  llmProvider: "openai",
  providerApiKey: process.env.OPENAI_API_KEY!,
  routerApiKey: process.env.PORTKEY_API_KEY!,
  model: "gpt-4o-mini",
  temperature: 0.1,
};

// Initialize tools and agents
const weatherToolRegistry = new ToolRegistry();
const weatherTool = new WeatherTool();
weatherToolRegistry.register(weatherTool);

const calculatorToolRegistry = new ToolRegistry();
const calculatorTool = new CalculatorTool();
calculatorToolRegistry.register(calculatorTool);

// Initialize language models
const agentLanguageModel = LanguageModelFactory.createGenericLLM(
  agentLanguageModelConfig
);

// Create agents
const weatherAgent = new Agent(
  {
    name: "weather-agent",
    description: "Provides weather information based on location.",
    capabilities: ["weather", "location"],
    systemPrompt:
      "You are a helpful assistant that provides weather information. Use the 'get_weather' tool to fetch weather data.",
  },
  agentLanguageModel,
  weatherToolRegistry
);

const assistantConfig: OpenAIAssistantLanguageModelConfig = {
  assistantId: process.env.GENERATED_OPENAI_ASSISTANT_ID!,
  llmRouterProvider: "openai-assistant",
  name: "Math Assistant",
  description: "A helpful math assistant",
  instructions: "You are a helpful math assistant. You can perform calculations using the calculator tool. Always show your work and explain your thinking.",
  providerApiKey: process.env.OPENAI_API_KEY_TESTING!,
  model: "gpt-4o-mini",
  temperature: 0.1,
};

const assistantLanguageModel = LanguageModelFactory.createOpenAIAssistant(assistantConfig);

const mathOpenAIAssistant = new Agent(
  {
    name: "Math Assistant",
    description: "A helpful math assistant",
    maxSteps: 5,
    temperature: 0.1,
  },
  assistantLanguageModel,
  calculatorToolRegistry
);

// Classifier Agent
const classifierAgent = new AgentClassifier(agentLanguageModel);

// Create the orchestrator
const orchestrator = new AgentOrchestrator(classifierAgent, [
  weatherAgent,
  mathOpenAIAssistant,
]);

function generateUUID() {
  return Math.random().toString(36).slice(2);
}

export async function POST(req: NextRequest) {
  const { messages: rawMessages } = await req.json();
  const messages: Message[] = rawMessages.map((msg: any) => ({
    role: msg.role,
    content: msg.content,
    name: msg.name,
    function_call: msg.function_call,
  }));

  const lastMessage = messages[messages.length - 1];
  const conversationHistory = messages.slice(0, -1);

  // Create streaming data instance
  const streamingData = new StreamData();

  // Generate message ID for user message
  const userMessageId = generateUUID();
  streamingData.append({
    type: 'user-message-id',
    content: userMessageId,
    timestamp: Date.now()
  });

  streamingData.append({
    type: 'status',
    status: 'Selecting Agent',
    timestamp: Date.now()
  });

  // Create the response stream immediately
  const stream = new ReadableStream({
    async start(controller) {
      streamingData.stream.pipeTo(new WritableStream({
        write(chunk) {
          controller.enqueue(chunk);
        }
      }));
    }
  });

  // Process in the background without blocking the response
  (async () => {
    try {
      const result = await orchestrator.process(
        lastMessage.content,
        conversationHistory,
        {
          stream: true,
          onUpdate: (statusMessage: string) => {
            streamingData.append({
              type: 'status',
              status: statusMessage,
              timestamp: Date.now()
            });
          },
        }
      );

      // Generate assistant message ID
      const assistantMessageId = generateUUID();
      streamingData.append({
        type: 'agent-message-id',
        content: assistantMessageId,
        timestamp: Date.now()
      });

      if (result instanceof Response) {
        // Handle the OpenAI Assistant's streaming response
        const reader = result.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let partialAssistantContent = '';
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });

            // Log the raw chunk for debugging
            console.log('Received chunk:', chunk);

            // Now, process the chunk
            // Assuming the chunk is in the format '<type>:<data>\n'
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.trim() === '') continue; // Skip empty lines
              const [prefix, data] = line.split(/:(.*)/s, 2); // Split only at the first ':'
              const messageType = parseInt(prefix, 10);
              if (isNaN(messageType)) {
                console.log('Unknown message type:', prefix);
                continue;
              }

              switch (messageType) {
                case 0: // Assistant's text content
                  // The data might be a JSON string, e.g., '"text"'
                  try {
                    const text = JSON.parse(data);
                    partialAssistantContent += text;
                    // Send the text delta to the client
                    streamingData.append({
                      type: 'text-delta',
                      content: {
                        textDelta: text
                      },
                      id: assistantMessageId,
                      timestamp: Date.now()
                    });
                  } catch (err) {
                    console.error('Error parsing text chunk:', err);
                  }
                  break;
                // Handle other message types if needed
                case 4:
                case 5:
                  // These might be metadata, we can log them
                  console.log('Received message of type', messageType, 'with data:', data);
                  break;
                default:
                  console.log('Received message of unknown type', messageType, 'with data:', data);
                  break;
              }
            }
          }
        }

        streamingData.append({
          type: 'finish',
          timestamp: Date.now()
        });

      } else if ("textStream" in result) {
        // Handle PortkeyStreamResponse
        for await (const chunk of (result as PortkeyStreamResponse).textStream) {
          // Process each text chunk
          streamingData.append({
            type: 'text-delta',
            content: {
              textDelta: chunk
            },
            id: assistantMessageId,
            timestamp: Date.now()
          });
        }
        streamingData.append({
          type: 'finish',
          timestamp: Date.now()
        });
      } else {
        console.log("Unexpected response type");
      }

      // Log that the response was delivered successfully
      console.log("Response delivered successfully");

    } catch (error) {
      console.error('Error processing request:', error);
      streamingData.append({
        type: 'error',
        error: 'An error occurred processing your request',
      });
    } finally {
      streamingData.close();
    }
  })();

  // Return the stream immediately
  return new Response(stream);
}