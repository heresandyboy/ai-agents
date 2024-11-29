import "dotenv/config";
import debug from "debug";

import { Agent } from "./lib/agents/base/Agent";
import { AgentOrchestrator } from "./lib/agents/orchestration/AgentOrchestrator";
import { ToolRegistry } from "./lib/tools/registry/ToolRegistry";
import { AgentClassifier } from "./lib/agents/classification/AgentClassifier";
import { LanguageModelFactory } from "./lib/llm/factories/LanguageModelFactory";
import {
  PortkeyLanguageModelConfig,
  PortkeyStreamResponse,
} from "./lib/llm/interfaces/ILanguageModel";
import { WeatherTool } from "./lib/tools/WeatherTool";
import { CalculatorTool } from "./lib/tools/CalculatorTool";

process.env.DEBUG = "*";

const log = debug("cli");
// Configure the language model for Agents
const agentLanguageModelConfig: PortkeyLanguageModelConfig = {
  llmRouterProvider: "portkey" as const,
  llmProvider: "openai" as const,
  providerApiKey: process.env.OPENAI_API_KEY_TESTING!,
  routerApiKey: process.env.PORTKEY_API_KEY!,
  model: "gpt-4o-mini",
  temperature: 0.1,
};

console.log("API KEY", process.env.OPENAI_API_KEY_TESTING!);

// Instantiate the language model
const agentLanguageModel = LanguageModelFactory.createGenericLLM(
  agentLanguageModelConfig
);

// Create tool registries and register tools
const weatherToolRegistry = new ToolRegistry();
const weatherTool = new WeatherTool();
weatherToolRegistry.register(weatherTool);

const calculatorToolRegistry = new ToolRegistry();
const calculatorTool = new CalculatorTool();
calculatorToolRegistry.register(calculatorTool);

// Agents
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

// Instantiate the language model for the classifier
const classifierLanguageModelConfig = agentLanguageModelConfig;

const classifierLanguageModel = LanguageModelFactory.createGenericLLM(
  classifierLanguageModelConfig
);

// Classifier Agent
const classifierAgent = new AgentClassifier(classifierLanguageModel);

// Create the orchestrator
const orchestrator = new AgentOrchestrator(classifierAgent, [
  weatherAgent,
  calculatorAgent,
]);

// Process user input
(async () => {
  const userInputs = [
    "What's the weather like in New York?",
    "Calculate 2 + 2.",
    "Tell me the temperature in London.",
    "What is the square root of 16?",
  ];

  for (const userInput of userInputs) {
    console.log(`User Input: ${userInput}`);
    // TODO: Add conversation history
    // TODO: Do options need to exist on Agent too, with override available on processs?
    const response = await orchestrator.process(userInput, [], {
      stream: true,
    });
    console.log(`Response: ${response}`);
    if ("textStream" in (response as PortkeyStreamResponse)) {
      // Handle PortkeyStreamResponse
      for await (const chunk of (response as PortkeyStreamResponse)
        .textStream) {
        process.stdout.write(chunk);
      }
      console.log("----");
    }
  }
})();
