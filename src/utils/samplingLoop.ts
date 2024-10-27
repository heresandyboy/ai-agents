// src/utils/samplingLoop.ts
import { generateText, Message, GenerateTextResult, CoreMessage } from "ai";
import { Context } from "../agent";
import { CoreTool } from "ai";
import { BaseAgent } from "../agents/baseAgent";

type Tools = Record<string, CoreTool>;

export async function samplingLoop<T extends Tools>(params: {
  content: string;
  context: Context;
  agent: BaseAgent<T>;
}): Promise<GenerateTextResult<T>> {
  // Initialize conversation with the user's message
  let messages: CoreMessage[] = [{ role: "user", content: params.content }];

  while (true) {
    // Generate the assistant's response
    const result = await generateText<T>({
      model: params.agent.getModel(),
      messages: messages,
      tools: params.agent.getTools(),
    });

    // Add the assistant's response to the conversation
    messages.push({ role: "assistant", content: result.text });

    // Check if the assistant invoked any tools
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        // Execute the tool and get the result
        const toolResult = await params.agent.executeTool(
          toolCall.toolName,
          toolCall.args
        );

        // Add the tool result back to the conversation
        messages.push({
          role: "user",
          content: toolResult.result,
        });

        if (toolResult.base64Image) {
          // Handle base64 images if necessary
          messages.push({
            role: "user",
            content: `![Image](data:image/png;base64,${toolResult.base64Image})`,
          });
        }
      }
    } else {
      // No more tool invocations, break the loop and return the result
      return result;
    }
  }
}
