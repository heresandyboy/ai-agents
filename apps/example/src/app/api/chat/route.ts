import { NextRequest } from "next/server";
import {
  Agent,
  AgentOrchestrator,
  AgentClassifier,
  LanguageModelFactory,
  ToolRegistry,
  type PortkeyLanguageModelConfig,
  type Message
} from "@zen/ai-agent-sdk";

// Import specific tools from the tools subpath
import { WeatherTool } from "@zen/ai-agent-sdk/tools";
import { CalculatorTool } from "@zen/ai-agent-sdk/tools";

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

export async function POST(req: NextRequest) {
  const { messages: rawMessages } = await req.json();

  // Convert the AI SDK messages to our Message type
  const messages: Message[] = rawMessages.map((msg: any) => ({
    role: msg.role,
    content: msg.content,
    name: msg.name,
    function_call: msg.function_call,
  }));

  try {
    const lastMessage = messages[messages.length - 1];
    const response = await orchestrator.process(
      lastMessage.content,
      messages.slice(0, -1),
      { stream: true }
    );

    // Handle Portkey streaming response
    if ("textStream" in response && "toDataStreamResponse" in response) {
      return response.toDataStreamResponse();
    }

    // Handle non-streaming response
    return new Response(JSON.stringify({ content: response }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
