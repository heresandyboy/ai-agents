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
  });

  // Start processing without awaiting the entire result
  const resultPromise = orchestrator.process(
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

  // Return the response immediately
  const response = resultPromise.then(async (result) => {
    if ("textStream" in result) {
      const assistantMessageId = generateUUID();
      streamingData.appendMessageAnnotation({
        messageIdFromServer: assistantMessageId,
      });

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          streamingData.append({
            type: 'text-delta',
            content: part.textDelta,
            id: assistantMessageId
          });
        } else if (part.type === 'tool-call') {
          streamingData.append({
            type: 'tool-call',
            data: part,
            id: assistantMessageId
          });
        }
      }
    }

    // Close the stream after processing
    streamingData.close();
  }).catch((error) => {
    console.error('Error processing request:', error);
    streamingData.append({
      type: 'error',
      error: 'An error occurred processing your request',
    });
    streamingData.close();
  });

  // Return the streaming response using toDataStreamResponse
  return (await resultPromise).toDataStreamResponse({
    data: streamingData,
  });
}