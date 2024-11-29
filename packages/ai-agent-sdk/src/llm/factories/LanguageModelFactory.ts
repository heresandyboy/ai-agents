import {
  type AssistantStreamResponse,
  type ConfigToStreamResponse,
  type LanguageModelConfig,
  type OpenAIAssistantLanguageModelConfig,
  type PortkeyLanguageModelConfig,
  type PortkeyStreamResponse,
  // type StreamingResponse,
} from "../interfaces/ILanguageModel";
import { PortkeyLanguageModel } from "../adapters/PortkeyAdapter";
import { type ILanguageModel } from "../interfaces/ILanguageModel";
import { OpenAIAssistantLanguageModel } from "../adapters/OpenAIAssistantAdapter";

export class LanguageModelFactory {
  static createGenericLLM(
    config: PortkeyLanguageModelConfig
  ): ILanguageModel<PortkeyLanguageModelConfig> {
    return new PortkeyLanguageModel(config);
  }

  static createOpenAIAssistant(
    config: OpenAIAssistantLanguageModelConfig
  ): ILanguageModel<OpenAIAssistantLanguageModelConfig> {
    return new OpenAIAssistantLanguageModel(config);
  }
}
