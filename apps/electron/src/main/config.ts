import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";

export interface AiModelConfig {
  id: string;
  name?: string;
}

export interface AiProviderConfig {
  id: string;
  apiKey: string;
  models: AiModelConfig[];
}

export interface AiModelSelection {
  providerId: string;
  modelId: string;
}

export type AiReasoningLevel = "default" | "low" | "medium" | "high";

export interface AiConfig {
  providers: AiProviderConfig[];
  activeAgentModel?: AiModelSelection;
}

export interface AiProviderCatalogItem {
  id: string;
  name: string;
  baseUrl: string;
  authType?: "api-key" | "codex";
  models: AiModelConfig[];
}

export interface AiModelOption {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  label: string;
}

export interface ResolvedAiModelConfig {
  provider: AiProviderConfig;
  catalog: AiProviderCatalogItem;
  model: AiModelConfig;
  selection: AiModelSelection;
  label: string;
}

export interface AppConfig {
  contentStorageRoot?: string;
  ai?: AiConfig;
}

export type ReflectaProfile = "dev" | "prod";

export function getReflectaProfile(): ReflectaProfile {
  if (process.env.REFLECTA_PROFILE === "dev" || process.env.REFLECTA_PROFILE === "prod") {
    return process.env.REFLECTA_PROFILE;
  }

  return app.isPackaged ? "prod" : "dev";
}

export function getAppConfigDir(): string {
  return getReflectaProfile() === "dev"
    ? path.join(app.getPath("appData"), "reflecta-dev")
    : app.getPath("userData");
}

export function getAppConfigFilePath(): string {
  return path.join(getAppConfigDir(), "reflecta-config.json");
}

export function getDefaultContentStorageRoot(): string {
  return getReflectaProfile() === "dev"
    ? path.join(app.getPath("appData"), "reflecta-dev")
    : app.getPath("userData");
}

let _cache: AppConfig | null = null;
const ENCRYPTED_VALUE_PREFIX = "safe:v1:";

const BUILT_IN_AI_PROVIDERS: AiProviderCatalogItem[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }, { id: "o3" }, { id: "o4-mini" }],
  },
  {
    id: "openai-codex",
    name: "Codex Subscription",
    baseUrl: "https://chatgpt.com/backend-api/codex",
    authType: "codex",
    models: [
      { id: "gpt-5.5", name: "GPT-5.5" },
      { id: "gpt-5.4", name: "GPT-5.4" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 mini" },
      { id: "gpt-5.3-codex-spark", name: "GPT-5.3 Codex Spark" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [{ id: "gemini-2.5-pro" }, { id: "gemini-2.5-flash" }, { id: "gemini-2.0-flash" }],
  },
  {
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    models: [{ id: "grok-4" }, { id: "grok-3" }, { id: "grok-3-mini" }],
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [{ id: "kimi-k2-0711-preview" }, { id: "moonshot-v1-8k" }, { id: "moonshot-v1-32k" }],
  },
  {
    id: "qwen",
    name: "Qwen DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [{ id: "qwen-plus" }, { id: "qwen-max" }, { id: "qwen-turbo" }],
  },
  {
    id: "zhipu",
    name: "Zhipu GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: [{ id: "glm-4-plus" }, { id: "glm-4-flash" }, { id: "glm-z1-air" }],
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    models: [
      { id: "deepseek-v4-pro" },
      { id: "deepseek-v4-flash" },
      { id: "minimax-m2.7" },
      { id: "minimax-m2.5" },
      { id: "glm-5.1" },
      { id: "glm-5" },
      { id: "kimi-k2.5" },
    ],
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    models: [
      { id: "glm-5.2" },
      { id: "glm-5.1" },
      { id: "kimi-k2.7" },
      { id: "kimi-k2.6" },
      { id: "deepseek-v4-pro" },
      { id: "deepseek-v4-flash" },
      { id: "mimo-v2.5" },
      { id: "mimo-v2.5-pro" },
    ],
  },
];

const BUILT_IN_AI_PROVIDER_IDS = new Set(BUILT_IN_AI_PROVIDERS.map((provider) => provider.id));

function isProviderConfigured(provider: AiProviderConfig): boolean {
  const catalog = getAiProviderCatalogItem(provider.id);
  return catalog.authType === "codex" || !!provider.apiKey;
}

function encryptConfigSecret(value: string): string {
  if (!value || !safeStorage.isEncryptionAvailable()) return value;
  return `${ENCRYPTED_VALUE_PREFIX}${safeStorage.encryptString(value).toString("base64")}`;
}

function decryptConfigSecret(value: string): string {
  if (!value.startsWith(ENCRYPTED_VALUE_PREFIX)) return value;
  try {
    return safeStorage.decryptString(
      Buffer.from(value.slice(ENCRYPTED_VALUE_PREFIX.length), "base64"),
    );
  } catch {
    return "";
  }
}

function transformAiConfigKeys(config: AiConfig | undefined, transform: (value: string) => string) {
  if (!config) return undefined;
  return {
    ...config,
    providers: config.providers.map((provider) => ({
      ...provider,
      apiKey: transform(provider.apiKey),
    })),
  };
}

function readPersistedConfig(raw: string): AppConfig {
  const parsed = JSON.parse(raw) as AppConfig;
  return { ...parsed, ai: transformAiConfigKeys(parsed.ai, decryptConfigSecret) };
}

function serializeConfig(config: AppConfig): string {
  return JSON.stringify(
    { ...config, ai: transformAiConfigKeys(config.ai, encryptConfigSecret) },
    null,
    2,
  );
}

export function readConfig(): AppConfig {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(getAppConfigFilePath(), "utf-8");
    _cache = readPersistedConfig(raw);
  } catch {
    _cache = {};
  }
  return _cache;
}

function firstModelSelection(providers: AiProviderConfig[]): AiModelSelection | undefined {
  const provider = providers.find((item) => isProviderConfigured(item) && item.models.length > 0);
  const model = provider?.models[0];
  return provider && model ? { providerId: provider.id, modelId: model.id } : undefined;
}

function hasModelSelection(config: AiConfig, selection: AiModelSelection): boolean {
  return config.providers.some(
    (provider) =>
      isProviderConfigured(provider) &&
      provider.id === selection.providerId &&
      provider.models.some((model) => model.id === selection.modelId),
  );
}

export function normalizeAiConfig(input: AiConfig): AiConfig {
  const providerIds = new Set<string>();
  const providers = input.providers.flatMap((provider) => {
    const providerId = provider.id.trim();
    if (!providerId || !BUILT_IN_AI_PROVIDER_IDS.has(providerId)) return [];
    if (providerIds.has(providerId)) throw new Error("AI Provider ID 不能重复");
    providerIds.add(providerId);

    const modelIds = new Set<string>();
    const models: AiModelConfig[] = provider.models.flatMap((model) => {
      const modelId = model.id.trim();
      if (!modelId) return [];
      if (modelIds.has(modelId)) throw new Error("AI 模型 ID 不能重复");
      modelIds.add(modelId);
      const name = model.name?.trim();
      return [{ id: modelId, ...(name ? { name } : {}) }];
    });

    const catalog = getAiProviderCatalogItem(providerId);
    return [
      {
        id: providerId,
        apiKey: provider.apiKey.trim(),
        models: models.length > 0 ? models : catalog.models,
      },
    ];
  });

  const config = { providers, activeAgentModel: input.activeAgentModel };
  return {
    providers,
    activeAgentModel:
      config.activeAgentModel && hasModelSelection(config, config.activeAgentModel)
        ? config.activeAgentModel
        : firstModelSelection(providers),
  };
}

export function getAiProviderCatalog(): AiProviderCatalogItem[] {
  return BUILT_IN_AI_PROVIDERS;
}

export function getAiProviderCatalogItem(providerId: string): AiProviderCatalogItem {
  const provider = BUILT_IN_AI_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) throw new Error("不支持的 AI Provider");
  return provider;
}

export function getAiConfig(): AiConfig {
  return normalizeAiConfig(readConfig().ai ?? { providers: [] });
}

export function getAiModelOptions(config = getAiConfig()): AiModelOption[] {
  return config.providers.flatMap((provider) => {
    if (!isProviderConfigured(provider)) return [];
    const catalog = getAiProviderCatalogItem(provider.id);
    return provider.models.map((model) => {
      const modelName = model.name || model.id;
      return {
        providerId: provider.id,
        providerName: catalog.name,
        modelId: model.id,
        modelName,
        label: `${catalog.name} / ${modelName}`,
      };
    });
  });
}

export function getActiveAiModelSelection(config = getAiConfig()): AiModelSelection | undefined {
  if (config.activeAgentModel && hasModelSelection(config, config.activeAgentModel)) {
    return config.activeAgentModel;
  }
  return firstModelSelection(config.providers);
}

export function getAiModelConfig(
  selection: AiModelSelection | undefined = undefined,
  config = getAiConfig(),
): ResolvedAiModelConfig {
  const selected = selection && hasModelSelection(config, selection) ? selection : undefined;
  const effectiveSelection = selected ?? getActiveAiModelSelection(config);
  if (!effectiveSelection) throw new Error("请先在设置中配置 AI Provider");

  const provider = config.providers.find((item) => item.id === effectiveSelection.providerId);
  const model = provider?.models.find((item) => item.id === effectiveSelection.modelId);
  if (!provider || !model || !isProviderConfigured(provider)) {
    throw new Error("请先在设置中配置 AI Provider");
  }

  const catalog = getAiProviderCatalogItem(provider.id);
  const modelName = model.name || model.id;
  return {
    provider,
    catalog,
    model,
    selection: effectiveSelection,
    label: `${catalog.name} / ${modelName}`,
  };
}

export function getActiveAiModelConfig(config = getAiConfig()): ResolvedAiModelConfig {
  return getAiModelConfig(undefined, config);
}

export function writeConfig(partial: Partial<AppConfig>): void {
  const config = readConfig();
  Object.assign(config, partial);
  if ("ai" in partial) delete (config as AppConfig & { aiProvider?: unknown }).aiProvider;
  _cache = config;
  const configFilePath = getAppConfigFilePath();
  fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  fs.writeFileSync(configFilePath, serializeConfig(config), "utf-8");
}

/** Used by AssetService and db — resolves the effective user content directory. */
export function getContentStorageRoot(): string {
  return (
    process.env.REFLECTA_CONTENT_STORAGE_ROOT ||
    readConfig().contentStorageRoot ||
    getDefaultContentStorageRoot()
  );
}
