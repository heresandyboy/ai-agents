import { LanguageModelConfig } from "../interfaces/ILanguageModel";
import { PortkeyLanguageModel } from "../adapters/PortkeyAdapter";
import { ILanguageModel } from "../interfaces/ILanguageModel";
import { OpenAIAssistantLanguageModel } from "../adapters/OpenAIAssistantAdapter";

export class LanguageModelFactory {
  static create(config: LanguageModelConfig): ILanguageModel {
    switch (config.llmRouterProvider) {
      case "portkey":
        return new PortkeyLanguageModel(config as any);
      case "openai-assistant":
        return new OpenAIAssistantLanguageModel(config as any);
      default:
        throw new Error(`Unsupported provider: ${config.llmRouterProvider}`);
    }
  }
}
