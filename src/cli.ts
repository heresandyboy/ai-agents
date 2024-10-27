import "dotenv/config";
// Enable debug logging
process.env.DEBUG = "agent:*";

import Agent from "./lib/agents/base/Agent";
import readline from "readline";
import { CalculatorTool } from "./lib/tools/CalculatorTool";
import debug from "debug";

const log = debug("agent:*");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  log("Starting Math Assistant CLI");

  // Initialize agent with calculator tool
  const agent = new Agent(
    {
      name: "Math Assistant",
      systemPrompt: `You are a helpful math assistant. You can perform calculations using the calculator tool. 
                    Always show your work and explain your thinking.`,
      model: "gpt-3.5-turbo",
      provider: "openai",
      temperature: 0.7,
    },
    [new CalculatorTool()]
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
        const response = await agent.process(input);
        console.log("\nAssistant:", response);
        log("Response delivered successfully");
      } catch (error) {
        log("Error processing input:", error);
        console.error("Error:", error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch((error) => {
  log("Fatal error:", error);
  console.error(error);
});
