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
    // const trace = this.langfuse.trace({ name: "User Request Trace" });

    try {
      const routingDecision = await this.router.getRoutingDecision(
        content,
        context
      );

      //   trace.event({
      //     name: "Routing Decision",
      //     metadata: routingDecision,
      //   });

      console.log(`Routing Reasoning: ${routingDecision.reasoning}`);

      const agent = this.agentManager.getAgent(
        routingDecision.selectedAgentName
      );

      if (!agent) {
        throw new Error(
          `Agent ${routingDecision.selectedAgentName} not found.`
        );
      }

      const agentResponse = await agent.handleRequest(content, context);

      if (agentResponse.updatedContext) {
        context = { ...context, ...agentResponse.updatedContext };
      }

      if (agentResponse.handoffAgentName) {
        const handoffAgent = this.agentManager.getAgent(
          agentResponse.handoffAgentName
        );

        if (!handoffAgent) {
          throw new Error(
            `Handoff agent ${agentResponse.handoffAgentName} not found.`
          );
        }

        // trace.event({
        //   name: "Agent Handoff",
        //   metadata: { from: agent.name, to: handoffAgent.name },
        // });

        return await handoffAgent.handleRequest(content, context);
      }

      //   trace.end({
      //     metadata: { response: agentResponse },
      //   });

      return agentResponse;
    } catch (error) {
      console.error("Error in AIHandler handleRequest:", error);
      //   trace.error({ message: error.message });
      throw error;
    }
  }
}
