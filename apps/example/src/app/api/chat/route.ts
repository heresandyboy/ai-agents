import {
  Agent,
  AgentClassifier,
  AgentOrchestrator,
  LanguageModelFactory,
  ToolRegistry,
  type Message,
  type PortkeyLanguageModelConfig,
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
  model: "gpt-4",
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

const calculatorAgent = new Agent(
  {
    name: "calculator-agent",
    description: "Performs mathematical calculations.",
    capabilities: ["math", "calculations"],
    systemPrompt:
      "You are a calculator assistant that can perform mathematical operations. Use the 'calculator' tool to evaluate expressions.",
  },
  agentLanguageModel,
  calculatorToolRegistry
);

// Classifier Agent
const classifierAgent = new AgentClassifier(agentLanguageModel);

// Create the orchestrator
const orchestrator = new AgentOrchestrator(classifierAgent, [
  weatherAgent,
  calculatorAgent,
]);

function generateUUID() {
  return Math.random().toString(36).slice(2);
}

// Function to sanitize parts by converting Date objects to strings
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
  } else {
    return value;
  }
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

      if ("textStream" in result) {
        // Generate assistant message ID
        const assistantMessageId = generateUUID();
        streamingData.appendMessageAnnotation({
          messageIdFromServer: assistantMessageId,
        });

        // Stream back all parts, including their types and content
        for await (const part of result.fullStream) {
          console.log('part', JSON.stringify(part, null, 2));

          // Sanitize the part before appending
          const sanitizedPart = sanitizeForJSON(part);

          // Append each part dynamically with type, content, id, and timestamp
          streamingData.append({
            type: part.type,
            content: sanitizedPart,
            id: assistantMessageId,
            timestamp: Date.now()
          });
        }
      }
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