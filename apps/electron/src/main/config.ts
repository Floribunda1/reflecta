import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { app } from "electron";
import { resolveRuntimePaths, type RuntimeAppConfig } from "@reflecta/server/runtime";
import { getRuntimeArg } from "./runtime-args";

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

export type RetrievalEmbeddingProvider = "disabled" | "local-llama-cpp" | "openai-compatible";

export interface RetrievalEmbeddingConfig {
  provider: RetrievalEmbeddingProvider;
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
  modelPath?: string;
}

export interface RetrievalConfig {
  embedding: RetrievalEmbeddingConfig;
}

export interface RetrievalEmbeddingModelManifest {
  id: string;
  name: string;
  runtime: "llama.cpp";
  modelId: string;
  repoId: string;
  fileName: string;
  downloadUrl: string;
  dimensions: number;
  sizeLabel: string;
}

export interface RetrievalEmbeddingModelStatus {
  manifest: RetrievalEmbeddingModelManifest;
  downloaded: boolean;
  modelPath: string;
  config: RetrievalConfig;
  download: RetrievalEmbeddingDownloadStatus;
}

export interface RetrievalEmbeddingDownloadStatus {
  state: "idle" | "downloading" | "downloaded" | "error";
  receivedBytes: number;
  totalBytes?: number;
  percent?: number;
  error?: string;
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
  retrieval?: RetrievalConfig;
}

export type ReflectaProfile = "dev" | "prod";

export function getReflectaProfile(): ReflectaProfile {
  return app.isPackaged ? "prod" : "dev";
}

function resolveElectronRuntime(appConfig?: RuntimeAppConfig) {
  return resolveRuntimePaths({
    processKind: "electron",
    buildKind: app.isPackaged ? "release" : "source",
    electronAppDataDir: app.getPath("appData"),
    electronUserDataDir: app.getPath("userData"),
    explicitAppConfigDir: getRuntimeArg("reflecta-app-config-dir"),
    explicitContentStorageRoot: getRuntimeArg("reflecta-content-root"),
    appConfig,
  });
}

export function getAppConfigDir(): string {
  return resolveElectronRuntime().appConfigDir;
}

export function getAppConfigFilePath(): string {
  return path.join(getAppConfigDir(), "reflecta-config.json");
}

export function getDefaultContentStorageRoot(): string {
  return resolveElectronRuntime().contentStorageRoot;
}

let _cache: AppConfig | null = null;
let retrievalEmbeddingDownload: RetrievalEmbeddingDownloadStatus = {
  state: "idle",
  receivedBytes: 0,
};

export const DEFAULT_RETRIEVAL_EMBEDDING_MODEL: RetrievalEmbeddingModelManifest = {
  id: "qwen3-embedding-0.6b-q8_0",
  name: "Qwen3 Embedding 0.6B",
  runtime: "llama.cpp",
  modelId: "Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0",
  repoId: "Qwen/Qwen3-Embedding-0.6B-GGUF",
  fileName: "Qwen3-Embedding-0.6B-Q8_0.gguf",
  downloadUrl:
    "https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-Q8_0.gguf",
  dimensions: 1024,
  sizeLabel: "639 MB",
};

const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  embedding: {
    provider: "disabled",
    modelId: DEFAULT_RETRIEVAL_EMBEDDING_MODEL.modelId,
    modelPath: "",
  },
};

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

function serializeConfig(config: AppConfig): string {
  return JSON.stringify(config, null, 2);
}

export function readConfig(): AppConfig {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(getAppConfigFilePath(), "utf-8");
    _cache = JSON.parse(raw) as AppConfig;
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

export function normalizeRetrievalConfig(input: RetrievalConfig | undefined): RetrievalConfig {
  const embedding = input?.embedding ?? DEFAULT_RETRIEVAL_CONFIG.embedding;
  const legacyDefaultEndpoint =
    embedding.provider === "openai-compatible" &&
    !embedding.apiKey &&
    (embedding.baseUrl?.trim() === "http://127.0.0.1:8080/v1" || !embedding.baseUrl) &&
    (!embedding.modelId.trim() ||
      embedding.modelId.trim() === DEFAULT_RETRIEVAL_EMBEDDING_MODEL.modelId);
  const provider = legacyDefaultEndpoint
    ? "local-llama-cpp"
    : embedding.provider === "local-llama-cpp" || embedding.provider === "openai-compatible"
      ? embedding.provider
      : "disabled";
  const modelId = embedding.modelId.trim() || DEFAULT_RETRIEVAL_EMBEDDING_MODEL.modelId;
  const baseUrl = embedding.baseUrl?.trim();
  const apiKey = embedding.apiKey?.trim();
  const modelPath = embedding.modelPath?.trim() || getRetrievalEmbeddingModelPath();
  return {
    embedding: {
      provider,
      modelId,
      modelPath,
      ...(baseUrl ? { baseUrl } : {}),
      ...(apiKey ? { apiKey } : {}),
    },
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

export function getRetrievalConfig(): RetrievalConfig {
  return normalizeRetrievalConfig(readConfig().retrieval);
}

export function getRetrievalEmbeddingModelPath(
  manifest = DEFAULT_RETRIEVAL_EMBEDDING_MODEL,
): string {
  return path.join(getAppConfigDir(), "models", "retrieval", manifest.fileName);
}

export function getRetrievalEmbeddingModelStatus(): RetrievalEmbeddingModelStatus {
  const modelPath = getRetrievalEmbeddingModelPath();
  const downloaded = fs.existsSync(modelPath);
  return {
    manifest: DEFAULT_RETRIEVAL_EMBEDDING_MODEL,
    downloaded,
    modelPath,
    config: getRetrievalConfig(),
    download:
      retrievalEmbeddingDownload.state === "downloading" ||
      retrievalEmbeddingDownload.state === "error"
        ? retrievalEmbeddingDownload
        : {
            state: downloaded ? "downloaded" : "idle",
            receivedBytes: downloaded ? fs.statSync(modelPath).size : 0,
          },
  };
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

export async function downloadDefaultRetrievalEmbeddingModel(): Promise<RetrievalEmbeddingModelStatus> {
  const modelPath = getRetrievalEmbeddingModelPath();
  fs.mkdirSync(path.dirname(modelPath), { recursive: true });
  if (fs.existsSync(modelPath)) return getRetrievalEmbeddingModelStatus();
  if (process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD === "1") {
    fs.writeFileSync(modelPath, "stub retrieval embedding model", "utf-8");
    retrievalEmbeddingDownload = {
      state: "downloaded",
      receivedBytes: fs.statSync(modelPath).size,
    };
    return getRetrievalEmbeddingModelStatus();
  }

  const tempPath = `${modelPath}.download`;
  try {
    const response = await fetch(DEFAULT_RETRIEVAL_EMBEDDING_MODEL.downloadUrl);
    if (!response.ok || !response.body) {
      throw new Error(`下载 embedding 模型失败：${response.status}`);
    }

    const totalBytes = Number(response.headers.get("content-length")) || undefined;
    retrievalEmbeddingDownload = { state: "downloading", receivedBytes: 0, totalBytes };
    let receivedBytes = 0;
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        receivedBytes += chunk.length;
        retrievalEmbeddingDownload = {
          state: "downloading",
          receivedBytes,
          totalBytes,
          percent: totalBytes ? Math.floor((receivedBytes / totalBytes) * 100) : undefined,
        };
        callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      progress,
      fs.createWriteStream(tempPath),
    );
    fs.renameSync(tempPath, modelPath);
    retrievalEmbeddingDownload = {
      state: "downloaded",
      receivedBytes: fs.statSync(modelPath).size,
      totalBytes,
      percent: 100,
    };
    return getRetrievalEmbeddingModelStatus();
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    retrievalEmbeddingDownload = {
      state: "error",
      receivedBytes: retrievalEmbeddingDownload.receivedBytes,
      totalBytes: retrievalEmbeddingDownload.totalBytes,
      percent: retrievalEmbeddingDownload.percent,
      error: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}

/** Used by AssetService and db — resolves the effective user content directory. */
export function getContentStorageRoot(): string {
  return resolveElectronRuntime(readConfig()).contentStorageRoot;
}
