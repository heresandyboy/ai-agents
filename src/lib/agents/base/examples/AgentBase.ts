// agent/base.ts
import { createPortkey } from "@portkey-ai/vercel-provider";
import { generateText } from "ai";

export class Agent {
  private context: AgentContext;
  private tools: Map<string, Tool>;
  private llmClient: ReturnType<typeof createPortkey>;

  constructor(private readonly config: AgentConfig, tools: Tool[] = []) {
    this.context = {
      messages: [
        {
          role: "system",
          content: config.systemPrompt,
        },
      ],
      memory: {},
    };

    this.tools = new Map(tools.map((tool) => [tool.getSchema().name, tool]));

    this.llmClient = createPortkey({
      apiKey: process.env.PORTKEY_API_KEY!,
      config: {
        provider: config.provider,
        api_key: process.env[`${config.provider.toUpperCase()}_API_KEY`]!,
        override_params: {
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        },
      },
    });
  }

  async process(input: string): Promise<string> {
    this.context.messages.push({
      role: "user",
      content: input,
    });

    const response = await generateText({
      model: this.llmClient.chatModel(""),
      messages: this.context.messages,
      tools: Array.from(this.tools.values()).map((t) => t.getSchema()),
    });

    if (response.toolCalls) {
      const tool = this.tools.get(response.toolCalls.name);
      if (tool) {
        const result = await tool.execute(response.toolCalls.parameters);
        this.context.messages.push({
          role: "tool",
          content: result,
          toolCall: {
            name: response.functionCall.name,
            parameters: response.functionCall.parameters,
          },
        });
        return this.process("Continue with the task using the tool result");
      }
    }

    this.context.messages.push({
      role: "assistant",
      content: response.text,
    });

    return response.text;
  }
}
