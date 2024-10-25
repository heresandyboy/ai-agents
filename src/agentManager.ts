import { Agent } from "./agent";

export class AgentManager {
  private agents: Map<string, Agent> = new Map();

  registerAgent(agent: Agent) {
    this.agents.set(agent.name, agent);
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}
