import {
  Agent,
  AgentClassifier,
  AgentOrchestrator,
  LanguageModelFactory,
  ToolRegistry,
  type Message,
  type OpenAIAssistantLanguageModelConfig,
  type PortkeyLanguageModelConfig
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
        // Handle OpenAI Assistant's streaming response
        const reader = result.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let partialContent = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;

            const [type, data] = line.split(/:(.*)/s, 2);
            const messageType = parseInt(type, 10);

            if (isNaN(messageType)) continue;

            const sanitizedData = sanitizeForJSON(JSON.parse(data));

            switch (messageType) {
              case 0: // Text content
                partialContent += sanitizedData;
                streamingData.append({
                  type: 'text-delta',
                  content: { textDelta: sanitizedData },
                  id: assistantMessageId,
                  timestamp: Date.now()
                });
                break;
              case 1: // Function calls
                streamingData.append({
                  type: 'function-call',
                  content: sanitizedData,
                  id: assistantMessageId,
                  timestamp: Date.now()
                });
                break;
              case 2: // Function results
                streamingData.append({
                  type: 'function-result',
                  content: sanitizedData,
                  id: assistantMessageId,
                  timestamp: Date.now()
                });
                break;
            }
          }
        }
      } else if ("textStream" in result) {
        // Handle PortkeyStreamResponse
        for await (const part of result.fullStream) {
          const sanitizedPart = sanitizeForJSON(part);
          streamingData.append({
            type: part.type,
            content: sanitizedPart,
            id: assistantMessageId,
            timestamp: Date.now()
          });
        }
      }

      streamingData.append({
        type: 'finish',
        timestamp: Date.now()
      });

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

  return new Response(stream);
}

// Helper function to sanitize JSON data
function sanitizeForJSON(value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  } else if (Array.isArray(value)) {
    return value.map(sanitizeForJSON);
  } else if (value !== null && typeof value === 'object') {
    const sanitizedObject: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitizedObject[key] = sanitizeForJSON(value[key]);
      }
    }
    return sanitizedObject;
  }
  return value;
}
