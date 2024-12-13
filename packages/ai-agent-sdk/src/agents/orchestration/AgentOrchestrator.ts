import {
  type GenerationResponse,
  type PortkeyStreamResponse,
} from "../../llm/interfaces/ILanguageModel";
import type { GenerationOptions, Message } from "../../types/common";
import { type Agent } from "../base/Agent";
import {
  type AgentClassifier,
  type ClassifierResult,
} from "../classification/AgentClassifier";

export class AgentOrchestrator {
  private agents: Agent<any>[];
  private classifierAgent: AgentClassifier<any>;

  constructor(classifierAgent: AgentClassifier<any>, agents: Agent<any>[]) {
    this.classifierAgent = classifierAgent;
    this.agents = agents;
  }

  public async process(
    input: string,
    conversationHistory: Message[] = [],
    options: GenerationOptions & { onUpdate?: (status: string) => void } = {}
  ): Promise<string | GenerationResponse | PortkeyStreamResponse | Response> {
    // Send a status update: Classifying input
    // options.onUpdate?.('Classifying input');

    // Classify the input to get the selected agent
    const classificationResult: ClassifierResult =
      await this.classifierAgent.classify(
        input,
        this.agents,
        conversationHistory,
        options.onUpdate // Pass the onUpdate callback
      );

    const selectedAgentName = classificationResult.selectedAgent;

    options.onUpdate?.(`Agent '${selectedAgentName}' responding`);

    console.log(`Classifier selected agent: ${selectedAgentName}`);

    const selectedAgent = this.agents.find(
      (agent) => agent.getName() === selectedAgentName
    );
    if (!selectedAgent) {
      throw new Error(`Agent not found: ${selectedAgentName}`);
    }

    // Append the classifier's messages to the conversation history
    const newHistory = [
      ...conversationHistory,
      {
        role: "assistant",
        content: `Selected agent: ${selectedAgentName}. Confidence: ${classificationResult.confidence}`,
      },
      { role: "user", content: input },
    ];

    // Process the input with the selected Agent
    const response = await selectedAgent.process(input, {
      stream: options.stream,
    });
    console.log("Orchestrator Response", JSON.stringify(response, null, 5));

    // Send final status update
    // options.onUpdate?.('Processing completed');

    return response;
  }
}
