// agent/base.ts
import { createPortkey } from "@portkey-ai/vercel-provider";
import { streamText, generateText, CoreTool } from "ai";
import { BaseTool } from "../tools/base";

export class Agent {
  private tools: Map<string, BaseTool>;
  private llmClient: ReturnType<typeof createPortkey>;

  constructor(private readonly config: AgentConfig, tools: BaseTool[] = []) {
    this.tools = new Map(tools.map((tool) => [tool.getMetadata().name, tool]));

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

  async process(input: string, stream = false): Promise<string> {
    const vercelTools = Array.from(this.tools.values()).map(
      (tool) => tool.getVercelTool() as CoreTool
    );

    if (stream) {
      return await this.streamResponse(input, vercelTools);
    }
    return await this.generateResponse(input, vercelTools);
  }

  private async streamResponse(
    input: string,
    tools: VercelAITool[]
  ): Promise<string> {
    const stream = await streamText({
      model: this.llmClient.chatModel(""),
      messages: [{ role: "user", content: input }],
      tools,
    });

    let response = "";
    for await (const chunk of stream) {
      response += chunk;
    }
    return response;
  }

  private async generateResponse(
    input: string,
    tools: VercelAITool[]
  ): Promise<string> {
    const { text } = await generateText({
      model: this.llmClient.chatModel(""),
      messages: [{ role: "user", content: input }],
      tools,
    });
    return text;
  }
}
