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

const debug = {
    log: (message: string, data?: any) => {
        console.log(`[${new Date().toISOString()}] ${message}`, data || '');
    },
    time: (label: string) => {
        debug.log(`⏱️ Starting: ${label}`);
        return performance.now();
    },
    timeEnd: (label: string, startTime: number) => {
        const duration = performance.now() - startTime;
        debug.log(`⏱️ Completed: ${label} (${duration.toFixed(2)}ms)`);
    }
};

// Create singleton instances
let orchestratorInstance: AgentOrchestrator | null = null;

/**
 * Creates and configures the AgentOrchestrator with necessary agents/tools.
 */
export function createOrchestrator(): AgentOrchestrator {
    if (orchestratorInstance) {
        return orchestratorInstance;
    }

    const startTime = debug.time('createOrchestrator');

    // Initialize all configurations and registries
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

    // Create and cache tool registries
    const weatherToolRegistry = new ToolRegistry();
    weatherToolRegistry.register(new WeatherTool());

    const calculatorToolRegistry = new ToolRegistry();
    calculatorToolRegistry.register(new CalculatorTool());

    // Create and cache language models
    const portkeyModel = LanguageModelFactory.createGenericLLM(portkeyConfig);
    const assistantModel = LanguageModelFactory.createOpenAIAssistant(openAIAssistantConfig);

    // Create and cache agents
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

    // Create and cache orchestrator
    orchestratorInstance = new AgentOrchestrator(classifierAgent, [weatherAgent, mathAssistant]);

    debug.timeEnd('createOrchestrator', startTime);
    return orchestratorInstance;
} 