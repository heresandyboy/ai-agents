import {
  type GenerationResponse,
  type ILanguageModel,
  type LanguageModelConfig,
  type PortkeyStreamResponse,
} from "../../llm/interfaces/ILanguageModel";
import { ClassificationTool } from "../../tools/ClassificationTool";
import { type ITool } from "../../tools/interfaces/ITool";
import { ToolRegistry } from "../../tools/registry/ToolRegistry";
import { type Message } from "../../types/common";
import { Agent } from "../base/Agent";
import { AgentError } from "../errors/AgentError";

export interface ClassifierResult {
  selectedAgent: string | null;
  confidence: number;
  reasoning: string;
}

export class AgentClassifier<TConfig extends LanguageModelConfig> {
  private agent: Agent<TConfig>;
  private promptTemplate: string;
  private classifierTool: ITool;
  private toolRegistry: ToolRegistry;

  constructor(languageModel: ILanguageModel<TConfig>, promptTemplate?: string) {
    // Use the provided prompt template or default
    this.promptTemplate = promptTemplate || defaultPromptTemplate;

    // Initialize the parse tool
    this.classifierTool = new ClassificationTool();

    // Initialize the tool registry and register the parse tool
    this.toolRegistry = new ToolRegistry();
    this.toolRegistry.register(this.classifierTool);

    // Agent configuration
    const agentConfig = {
      name: "AgentClassifier",
      description: "Classifies user input to select the appropriate agent.",
    };

    // Initialize the agent
    this.agent = new Agent<TConfig>(
      agentConfig,
      languageModel,
      this.toolRegistry
    );
  }

  private formatAgentDescriptions(agents: Agent<any>[]): string {
    const agentEntries = agents.map(
      (agent) => `<Agent>
agent-name: ${agent.getName()}
agent-description: ${agent.getDescription()}
</Agent>`
    );

    return `<Agents>
${agentEntries.join("\n")}
</Agents>`;
  }

  public async classify(
    inputText: string,
    agents: Agent<any>[],
    conversationHistory: Message[] = [],
    onUpdate?: (status: string) => void
  ): Promise<ClassifierResult> {
    onUpdate?.('Analyzing agents');

    // Replace the existing agent descriptions preparation
    const agentDescriptions = this.formatAgentDescriptions(agents);

    // Prepare variables
    const variables = {
      AGENT_DESCRIPTIONS: agentDescriptions,
      HISTORY: this.formatMessages(conversationHistory),
    };

    // Fill in the prompt template
    const systemPrompt = this.fillTemplate(this.promptTemplate, variables);

    // Set the system prompt for the agent
    this.agent.setSystemPrompt(systemPrompt);

    // Send status update after setting system prompt
    // onUpdate?.('System prompt prepared');

    // Prepare messages
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: inputText },
    ];

    // Process messages with toolChoice
    const response = await this.agent.processMessages(messages, {
      stream: false,
      maxSteps: 1,
      toolChoice: { type: 'tool', toolName: this.classifierTool.getName() },
    });

    // Send status update after classification
    // onUpdate?.('Classification completed');

    // Handle the response
    const parsedResult = await this.handleResponse(response);
    return parsedResult;
  }

  private async handleResponse(
    response: string | GenerationResponse | PortkeyStreamResponse | Response
  ): Promise<ClassifierResult> {
    try {
      // Handle GenerationResponse
      if (typeof response === "object" && response !== null) {
        if ("steps" in response && Array.isArray(response.steps)) {
          const lastStep = response.steps[response.steps.length - 1];
          if (lastStep?.toolResults?.[0]?.result) {
            const result = lastStep.toolResults[0].result as ClassifierResult;
            return {
              selectedAgent: result.selectedAgent || null,
              confidence: result.confidence || 0,
              reasoning: result.reasoning || "",
            } as ClassifierResult;
          }
        }
      }

      // Handle PortkeyStreamResponse
      if ("textStream" in (response as PortkeyStreamResponse)) {
        // TODO: Implement stream handling
        throw new AgentError("Stream response handling not yet implemented");
      }

      // Handle Response (OpenAI Assistant)
      if (response instanceof Response) {
        // TODO: Implement OpenAI Assistant response handling
        throw new AgentError(
          "OpenAI Assistant response handling not yet implemented"
        );
      }

      // If we reach here, we couldn't handle the response
      throw new AgentError("Unsupported response format");
    } catch (error) {
      throw new AgentError("Failed to parse classifier response", {
        cause: error,
      });
    }
  }

  private formatMessages(messages: Message[]): string {
    return messages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
  }

  private fillTemplate(
    template: string,
    variables: Record<string, string>
  ): string {
    console.log("Variables:", variables);
    const filledTemplate = template.replace(
      /{{(\w+)}}/g,
      (match, key) => variables[key] || match
    );

    console.log("Filled template:", filledTemplate);

    return filledTemplate;
  }
}

const defaultPromptTemplate = `You are AgentMatcher, an intelligent assistant designed to analyze user queries and match them with the most suitable agent or department.

Analyze the following agents and the user's request:

{{AGENT_DESCRIPTIONS}}

Previous conversation history:
{{HISTORY}}

Important Instructions:
1. Select the most appropriate agent based on the user's input
2. If the input is a follow-up (e.g., "yes", "ok", "tell me more"), use the same agent from history
3. The selectedAgent MUST be an exact agent-name from the Agents list
4. Never return null for selectedAgent - use "unknown" if unsure

Respond with ONLY a JSON object in this exact format:
{
  "userInput": "<the user's input text>",
  "selectedAgent": "<exact agent-name from Agents list>",
  "confidence": <number between 0 and 1>,
  "reasoning": "<your explanation>"
}`;

// const ClassificationSchema = z.object({
//   selected_agent: z.string().nullable(),
//   confidence: z.number().min(0).max(1),
// });
