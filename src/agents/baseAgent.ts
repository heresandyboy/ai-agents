import { GenerateTextResult, CoreTool } from "ai";
import { Agent, Context } from "../agent";

export abstract class BaseAgent<
  T extends Record<string, CoreTool> = Record<string, CoreTool>
> implements Agent
{
  constructor(public name: string, public capabilities: string[]) {}

  abstract handleRequest(
    content: string,
    context: Context
  ): Promise<GenerateTextResult<T>>;
}
