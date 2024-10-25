import { tool } from "ai";
import { bashCommandSchema, type BashCommand } from "./bash.schema";

export const bashTool = tool({
  description: "Execute bash commands",
  parameters: bashCommandSchema,
  execute: async ({ command }: BashCommand) => {
    // Implement bash command execution
    return { result: `Executed bash: ${command}` };
  },
});

