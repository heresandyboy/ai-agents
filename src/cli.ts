process.env.DEBUG = "*";
import "dotenv/config";
import readline from "readline";
import debug from "debug";
import { Agent } from "./lib/agents/base/Agent";
import { CalculatorTool } from "./lib/tools/CalculatorTool";
import { ToolRegistry } from "./lib/tools/registry/ToolRegistry";
import { LanguageModelFactory } from "./lib/llm/factories/LanguageModelFactory";
import {
  OpenAIAssistantLanguageModelConfig,
  PortkeyLanguageModelConfig,
  PortkeyStreamResponse,
} from "./lib/llm/interfaces/ILanguageModel";

// Enable debug logging
// process.env.DEBUG = "agent:*,llm:*,tools:*";

const log = debug("cli");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  log("Starting Math Assistant CLI");

  // =================== Portkey/Generic Language Model ===================
  const config: PortkeyLanguageModelConfig = {
    llmRouterProvider: "portkey" as const,
    llmProvider: "openai" as const,
    routerApiKey: process.env.PORTKEY_API_KEY!,
    providerApiKey: process.env.OPENAI_API_KEY_TESTING!,
    model: "gpt-4o-mini",
    temperature: 0.7,
  };

  const languageModel = LanguageModelFactory.createGenericLLM(config);

  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new CalculatorTool());

  const agent = new Agent(
    {
      name: "Math Assistant",
      systemPrompt: `You are a helpful math assistant. You can perform calculations using the calculator tool.
                    Always show your work and explain your thinking.`,
      maxSteps: 5,
      temperature: 0.7,
    },
    languageModel,
    toolRegistry
    // todo Memory Observers (elastic, dynamo, redis etc)
    // todo RAG sources, either seperate from tools as as an actual tool. Need more thinking.
  );

  // =================== Assistant API as 'Language Model' ===================

  const assistantConfig: OpenAIAssistantLanguageModelConfig = {
    assistantId: process.env.GENERATED_OPENAI_ASSISTANT_ID!, // TODO: AA - This needs to be optional, to create one, then some way to update the real ID - no idea yet (manual urgh)
    llmRouterProvider: "openai-assistant",
    name: "Math Assistant",
    description: "A helpful math assistant",
    instructions:
      "You are a helpful math assistant. You can perform calculations using the calculator tool. Always show your work and explain your thinking.",
    providerApiKey: process.env.OPENAI_API_KEY_TESTING!,
    model: "gpt-4o-mini",
    temperature: 0.1,
  };

  const assistantLanguageModel =
    LanguageModelFactory.createOpenAIAssistant(assistantConfig);

  const assistantAgent = new Agent(
    {
      name: "Math Assistant",
      maxSteps: 5,
      temperature: 0.1,
    },
    assistantLanguageModel,
    toolRegistry
  );

  console.log("Math Assistant is ready! Type 'exit' to quit.");

  const askQuestion = () => {
    rl.question("\nYour question: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        log("Exiting CLI");
        rl.close();
        return;
      }

      try {
        log(`Processing user input: "${input}"`);
        // const response = await agent.process(input, { stream: true });
        const response = await assistantAgent.process(input, { stream: true });

        if (typeof response === "string") {
          console.log("\nAssistant:", response);
        } else if (response instanceof Response) {
          // Handle streaming response
          process.stdout.write("\nAssistant: ");

          const reader = response.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder("utf-8");
            let done = false;
            while (!done) {
              const { value, done: streamDone } = await reader.read();
              done = streamDone;
              if (value) {
                process.stdout.write(decoder.decode(value, { stream: true }));
              }
            }
          }
          process.stdout.write("\n----DONE----\n"); // New line before and after DONE message
        } else if ("textStream" in response) {
          // Handle PortkeyStreamResponse
          for await (const chunk of (response as PortkeyStreamResponse)
            .textStream) {
            process.stdout.write(chunk);
          }
          process.stdout.write("\n----DONE----\n");
        } else {
          console.log("Unexpected response type");
        }

        log("Response delivered successfully");
      } catch (error) {
        log("Error processing input:", error);
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch((error) => {
  log("Fatal error:", error);
  console.error(
    "Fatal error:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
