import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getAiModelConfig, type AiModelSelection } from "../../config";
import { getCodexCredentials } from "./codex-auth";

function toCamelCase(value: string) {
  return value.replace(/[_-]([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export async function getAgentModel(selection?: AiModelSelection) {
  const config = getAiModelConfig(selection);
  const baseURL = config.catalog.baseUrl || "https://api.openai.com/v1";
  const providerOptionsKey =
    config.catalog.id === "openai" || config.catalog.id === "openai-codex"
      ? "openai"
      : toCamelCase(config.catalog.id);
  const codexCredentials =
    config.catalog.id === "openai-codex" ? await getCodexCredentials() : undefined;
  const model =
    config.catalog.id === "openai" || config.catalog.id === "openai-codex"
      ? createOpenAI({
          apiKey: codexCredentials?.accessToken ?? config.provider.apiKey,
          baseURL,
          headers: codexCredentials
            ? {
                "chatgpt-account-id": codexCredentials.accountId,
                "OpenAI-Beta": "responses=experimental",
                originator: "reflecta",
              }
            : undefined,
          name: config.catalog.id,
        }).responses(config.model.id)
      : createOpenAICompatible({
          name: config.catalog.id,
          apiKey: config.provider.apiKey,
          baseURL,
        })(config.model.id);

  return {
    model,
    modelId: `${config.provider.id}:${config.model.id}`,
    codexSubscription: config.catalog.id === "openai-codex",
    providerOptionsKey,
  };
}
