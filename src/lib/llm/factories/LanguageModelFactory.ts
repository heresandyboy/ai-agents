import {
  AssistantStreamResponse,
  ConfigToStreamResponse,
  LanguageModelConfig,
  OpenAIAssistantLanguageModelConfig,
  PortkeyLanguageModelConfig,
  PortkeyStreamResponse,
  StreamingResponse,
} from "../interfaces/ILanguageModel";
import { PortkeyLanguageModel } from "../adapters/PortkeyAdapter";
import { ILanguageModel } from "../interfaces/ILanguageModel";
import { OpenAIAssistantLanguageModel } from "../adapters/OpenAIAssistantAdapter";

export class LanguageModelFactory {
  static create<TConfig extends LanguageModelConfig>(
    config: TConfig
  ): ILanguageModel<TConfig> {
    switch (config.llmRouterProvider) {
      case "portkey":
        return new PortkeyLanguageModel(
          config as PortkeyLanguageModelConfig
        ) as unknown as ILanguageModel<TConfig>;
      case "openai-assistant":
        return new OpenAIAssistantLanguageModel(
          config as OpenAIAssistantLanguageModelConfig
        ) as unknown as ILanguageModel<TConfig>;
      default:
        const _config = config as LanguageModelConfig;
        throw new Error(`Unsupported provider: ${_config.llmRouterProvider}`);
    }
  }
}
