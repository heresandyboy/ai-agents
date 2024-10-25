import { AgentManager } from "./agentManager";
import { AIHandler } from "./handler";
import { ComputerAgent } from "./agents/computerAgent";
import { LocalAgent } from "./agents/localAgent";

(async () => {
  const agentManager = new AgentManager();
  agentManager.registerAgent(new ComputerAgent());
  agentManager.registerAgent(new LocalAgent());

  const aiHandler = new AIHandler(agentManager);

  const userInput = "Could you execute a code snippet for me?";

  try {
    const response = await aiHandler.handleRequest(userInput);
    console.log("AI Response:", response);
  } catch (error) {
    console.error("Error handling request:", error);
  }
})();
