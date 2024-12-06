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

import { createDataStreamResponse, type DataStreamWriter } from 'ai';

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

export async function POST(req: NextRequest) {
  const { messages: rawMessages } = await req.json();

  // Convert the AI SDK messages to our Message type
  const messages: Message[] = rawMessages.map((msg: any) => ({
    role: msg.role,
    content: msg.content,
    name: msg.name,
    function_call: msg.function_call,
  }));

  // Use createDataStreamResponse to handle streaming data
  return createDataStreamResponse({
    async execute(dataStream: DataStreamWriter) {
      try {
        const lastMessage = messages[messages.length - 1];
        const conversationHistory = messages.slice(0, -1);

        // Send initial status message
        dataStream.writeData({ status: 'Understanding Query' });

        // Call the orchestrator's process method with onUpdate callback
        const response = await orchestrator.process(
          lastMessage.content,
          conversationHistory,
          {
            stream: true,
            onUpdate: (statusMessage: string) => {
              // Send status updates to the client
              dataStream.writeData({ status: statusMessage });
            },
          }
        );

        if ("textStream" in response && "mergeIntoDataStream" in response) {
          dataStream.writeData('OK OK OK');
          response.mergeIntoDataStream(dataStream);
        }

        dataStream.writeData('NOT OK')

        // // Handle streaming response
        // if ('textStream' in response && typeof response.textStream === 'object') {
        //   // Merge the text stream into the dataStream
        //   for await (const chunk of response.textStream) {
        //     dataStream.writeData({ content: chunk });
        //   }
        // } else {
        //   // Handle non-streaming response
        //   dataStream.writeData({ content: response });
        // }
      } catch (error) {
        console.error('Error processing request:', error);
        dataStream.writeData({ error: 'An error occurred processing your request' });
      }
    },
    onError: (error) => {
      // Expose the error message to the client if needed
      return error instanceof Error ? error.message : String(error);
    },
  });
}
