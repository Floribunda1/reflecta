import type { Api, Model } from "@earendil-works/pi-ai";
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { readConfig } from "../../config";

const REFLECTA_PROVIDER = "reflecta";

export async function createReflectaModelRegistry(): Promise<{
  modelRegistry: ModelRegistry;
  model: Model<Api>;
}> {
  const config = readConfig().aiProvider;
  if (!config?.apiKey) {
    throw new Error("请先在设置中配置 AI Provider");
  }

  const modelId = config.model?.trim() || "gpt-4o";
  const baseUrl = (config.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");

  const authStorage = AuthStorage.inMemory({
    [REFLECTA_PROVIDER]: { type: "api_key", key: config.apiKey },
  });
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  modelRegistry.registerProvider(REFLECTA_PROVIDER, {
    baseUrl,
    api: "openai-completions",
    apiKey: config.apiKey,
    models: [
      {
        id: modelId,
        name: modelId,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 8_192,
      },
    ],
  });

  const model = modelRegistry.find(REFLECTA_PROVIDER, modelId);
  if (!model) {
    throw new Error(`无法加载模型 ${modelId}`);
  }

  return { modelRegistry, model };
}
