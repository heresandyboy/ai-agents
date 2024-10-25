import { AgentManager } from "./agentManager";
import { Router } from "./router";
import { Context } from "./agent";
// import { Langfuse } from "langfuse";

export class AIHandler {
  private agentManager: AgentManager;
  private router: Router;
  //   private langfuse = new Langfuse({
  //     publicKey: "YOUR_LANGFUSE_PUBLIC_KEY",
  //     secretKey: "YOUR_LANGFUSE_SECRET_KEY",
  //   });

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.router = new Router(this.agentManager.getAllAgents());
  }

  async handleRequest(content: string, context: Context = {}) {
    console.log("\n🔄 AIHandler: Processing request");
    console.log("📨 Content:", content);
    console.log("🔍 Context:", context);

    try {
      console.log("🧭 Getting routing decision...");
      const routingDecision = await this.router.getRoutingDecision(
        content,
        context
      );

      console.log("🎯 Routing Decision:", routingDecision);
      console.log(`💭 Routing Reasoning: ${routingDecision.reasoning}`);

      const agent = this.agentManager.getAgent(
        routingDecision.selectedAgentName
      );

      if (!agent) {
        throw new Error(
          `Agent ${routingDecision.selectedAgentName} not found.`
        );
      }

      console.log(`🤖 Executing agent: ${agent.name}`);
      const agentResponse = await agent.handleRequest(content, context);

      if (agentResponse.updatedContext) {
        console.log("📝 Updating context:", agentResponse.updatedContext);
        context = { ...context, ...agentResponse.updatedContext };
      }

      if (agentResponse.handoffAgentName) {
        console.log(
          `🔄 Handing off to agent: ${agentResponse.handoffAgentName}`
        );
        const handoffAgent = this.agentManager.getAgent(
          agentResponse.handoffAgentName
        );

        if (!handoffAgent) {
          throw new Error(
            `Handoff agent ${agentResponse.handoffAgentName} not found.`
          );
        }

        return await handoffAgent.handleRequest(content, context);
      }

      return agentResponse;
    } catch (error) {
      console.error("❌ Error in AIHandler handleRequest:", error);
      throw error;
    }
  }
}
