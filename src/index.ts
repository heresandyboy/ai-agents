import "dotenv/config";
import { AgentManager } from "./agentManager";
import { AIHandler } from "./handler";
import { ComputerAgent } from "./agents/computerAgent";
import { LocalAgent } from "./agents/localAgent";
import { safeStringify } from "./utils/logging";

(async () => {
  console.log("🚀 Application starting...");

  const agentManager = new AgentManager();
  console.log("📋 Initializing AgentManager");

  agentManager.registerAgent(new ComputerAgent());
  console.log("🤖 Registered ComputerAgent");

  const aiHandler = new AIHandler(agentManager);
  console.log("🎮 AIHandler initialized");

  const userInput =
    "Move the mouse to coordinates 500,500 and perform a right click";
  console.log("\n📝 Processing user input:", userInput);

  try {
    const response = await aiHandler.handleRequest(userInput);
    console.log("\n✅ AI Response:", safeStringify(response));
  } catch (error) {
    console.error("❌ Error handling request:", error);
  }
})();
