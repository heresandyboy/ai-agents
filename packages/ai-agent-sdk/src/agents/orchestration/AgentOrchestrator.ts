import debug from "debug";
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

debug.enable("*");
const log = debug("llm:agent-orchestrator)");

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
    log('Orchestrator processing input', { input, historyLength: conversationHistory.length, options });

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
    log('Classification result', classificationResult);

    const selectedAgentName = classificationResult.selectedAgent;
    log('Selected agent', { agentName: selectedAgentName });

    // options.onUpdate?.(`${classificationResult.reasoning}`);
    // options.onUpdate?.(`Confidence: ${classificationResult.confidence}`);

    options.onUpdate?.(`Agent '${selectedAgentName}' responding`);

    console.log(`Classifier selected agent: ${selectedAgentName}`);

    const selectedAgent = this.agents.find(
      (agent) => agent.getName() === selectedAgentName
    );
    if (!selectedAgent) {
      log('No agent selected, using default response');
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

    log('Processing with selected agent');
    // Process the input with the selected Agent
    const response = await selectedAgent.process(input, {
      stream: options.stream,
    });
    log('Agent processing completed', { responseType: typeof response });
    console.log("Orchestrator Response", JSON.stringify(response, null, 5));

    // Send final status update
    // options.onUpdate?.('Processing completed');

    return response;
  }
}
