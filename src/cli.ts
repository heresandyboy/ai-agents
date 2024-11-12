process.env.DEBUG = "*";
import "dotenv/config";
import readline from "readline";
import debug from "debug";
import { Agent } from "./lib/agents/base/Agent";
import { CalculatorTool } from "./lib/tools/CalculatorTool";
import { ToolRegistry } from "./lib/tools/registry/ToolRegistry";
import { LanguageModelFactory } from "./lib/llm/factories/LanguageModelFactory";

// Enable debug logging
// process.env.DEBUG = "agent:*,llm:*,tools:*";

const log = debug("cli");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  log("Starting Math Assistant CLI");

  const languageModel = LanguageModelFactory.create({
    llmRouterProvider: "portkey",
    llmProvider: "openai",
    routerApiKey: process.env.PORTKEY_API_KEY!,
    providerApiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

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
        const response = await agent.process(input, { stream: true });

        if (typeof response === "string") {
          console.log("\nAssistant:", response);
        } else {
          // Handle streaming response
          process.stdout.write("\nAssistant: ");

          // Convert the StreamTextResult to a readable stream
          // const stream = response.textStream();
          for await (const chunk of response.textStream) {
            process.stdout.write(chunk);
            // if (chunk.type === "text") {
            //   process.stdout.write(chunk.text);
            // } else if (chunk.type === "tool") {
            //   console.log("\n[Tool Call]:", chunk.tool);
            // }
          }
          process.stdout.write("----DONE----"); // New line after stream ends
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
