import { type ITool, type IToolRegistry } from "../interfaces/ITool";
import debug from "debug";

const log = debug("tools:registry");

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, ITool> = new Map();

  register(tool: ITool): void {
    const name = tool.getName();
    if (this.tools.has(name)) {
      log(`Warning: Overwriting existing tool: ${name}`);
    }
    this.tools.set(name, tool);
    log(`Registered tool: ${name}`);
  }

  unregister(toolName: string): void {
    if (this.tools.delete(toolName)) {
      log(`Unregistered tool: ${toolName}`);
    } else {
      log(`Attempted to unregister non-existent tool: ${toolName}`);
    }
  }

  getTools(): Map<string, ITool> {
    return new Map(this.tools);
  }
}
