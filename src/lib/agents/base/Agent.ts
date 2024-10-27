// agent/agent.ts
import { createPortkey } from "@portkey-ai/vercel-provider";
import { generateText } from "ai";
// import { AgentConfig } from "../types/agent";
// import { BaseTool } from "../tools/base";
import { AgentConfig } from "../types/agent";
import { BaseTool } from "../../tools/base/BaseTool";

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

  public addTool(tool: BaseTool) {
    this.tools.set(tool.getMetadata().name, tool);
  }

  public async process(input: string): Promise<string> {
    const messages = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: input },
    ];

    const vercelAITools = Array.from(this.tools.values()).map((tool) =>
      tool.getVercelTool()
    );

    const response = await generateText({
      model: this.llmClient.chatModel(""),
      messages,
      tools: vercelAITools,
    });

    // Optionally handle function calls and tool execution results here

    return response.text;
  }
}
