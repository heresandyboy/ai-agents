import "dotenv/config";
import { AgentManager } from "./agentManager";
import { AIHandler } from "./handler";
import { ComputerAgent } from "./agents/computerAgent";
import { LocalAgent } from "./agents/localAgent";

(async () => {
  const agentManager = new AgentManager();
  agentManager.registerAgent(new ComputerAgent());
  //   agentManager.registerAgent(new LocalAgent());

  const aiHandler = new AIHandler(agentManager);

  // Test computer control
  const userInput =
    "Move the mouse to coordinates 500,500 and perform a right click";

  try {
    const response = await aiHandler.handleRequest(userInput);
    console.log("AI Response:", response);
  } catch (error) {
    console.error("Error handling request:", error);
  }
})();
