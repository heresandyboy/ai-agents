import { Agent } from "../base/Agent";
import { GenerationOptions, Message } from "../../types/common";
import {
  AgentClassifier,
  ClassifierResult,
} from "../classification/AgentClassifier";
import {
  GenerationResponse,
  PortkeyStreamResponse,
} from "../../llm/interfaces/ILanguageModel";

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
    options: GenerationOptions = {}
  ): Promise<string | GenerationResponse | PortkeyStreamResponse | Response> {
    // Classify the input to get the selected agent
    const classificationResult: ClassifierResult =
      await this.classifierAgent.classify(
        input,
        this.agents,
        conversationHistory
      );

    const selectedAgentName = classificationResult.selectedAgent;

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

    return response;
  }
}
