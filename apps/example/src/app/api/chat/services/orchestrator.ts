import {
    Agent,
    AgentClassifier,
    AgentOrchestrator,
    LanguageModelFactory,
    ToolRegistry,
    type OpenAIAssistantLanguageModelConfig,
    type PortkeyLanguageModelConfig,
} from "@zen/ai-agent-sdk";
import { CalculatorTool, WeatherTool } from "@zen/ai-agent-sdk/tools";

/**
 * Creates and configures the AgentOrchestrator with necessary agents/tools.
 */
export function createOrchestrator(): AgentOrchestrator {
    const portkeyConfig: PortkeyLanguageModelConfig = {
        llmRouterProvider: "portkey",
        llmProvider: "openai",
        providerApiKey: process.env.OPENAI_API_KEY!,
        routerApiKey: process.env.PORTKEY_API_KEY!,
        model: "gpt-4o-mini",
        temperature: 0.1,
    };

    const openAIAssistantConfig: OpenAIAssistantLanguageModelConfig = {
        assistantId: process.env.GENERATED_OPENAI_ASSISTANT_ID!,
        llmRouterProvider: "openai-assistant",
        name: "Math Assistant",
        description: "A helpful math assistant",
        instructions:
            "You are a helpful math assistant. Perform calculations using the calculator tool. Show your work and reasoning.",
        providerApiKey: process.env.OPENAI_API_KEY_TESTING!,
        model: "gpt-4o-mini",
        temperature: 0.1,
    };

    const weatherToolRegistry = new ToolRegistry();
    weatherToolRegistry.register(new WeatherTool());

    const calculatorToolRegistry = new ToolRegistry();
    calculatorToolRegistry.register(new CalculatorTool());

    const portkeyModel = LanguageModelFactory.createGenericLLM(portkeyConfig);
    const classifierAgent = new AgentClassifier(portkeyModel);

    const weatherAgent = new Agent(
        {
            name: "weather-agent",
            description: "Provides weather info based on location",
            capabilities: ["weather", "location"],
            systemPrompt:
                "You are a helpful assistant that provides weather data. Use 'get_weather' to fetch weather.",
        },
        portkeyModel,
        weatherToolRegistry
    );

    const assistantModel =
        LanguageModelFactory.createOpenAIAssistant(openAIAssistantConfig);

    const mathAssistant = new Agent(
        {
            name: "Math Assistant",
            description: "A helpful math assistant",
            maxSteps: 5,
            temperature: 0.1,
        },
        assistantModel,
        calculatorToolRegistry
    );

    return new AgentOrchestrator(classifierAgent, [weatherAgent, mathAssistant]);
} 