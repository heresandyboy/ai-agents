import { Agent, AgentResponse, Context } from "../agent";

export abstract class BaseAgent implements Agent {
  constructor(public name: string, public capabilities: string[]) {}

  abstract handleRequest(
    content: string,
    context: Context
  ): Promise<AgentResponse>;
}
