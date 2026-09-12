import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { app } from "electron";
import {
  clampThinkingLevel,
  getModels,
  getSupportedThinkingLevels,
  type Api,
  type Model,
} from "@earendil-works/pi-ai/compat";

import type {
  AiConfig,
  AiModelOption,
  AiModelSelection,
  AiProviderConfig,
  AiProviderDefinition,
  AiProviderModel,
  AiReasoningLevel,
  ReflectaProfile,
  RetrievalConfig,
  RetrievalEmbeddingDownloadStatus,
  RetrievalEmbeddingModelManifest,
  RetrievalEmbeddingModelStatus,
} from "@reflecta/shared";

const AI_REASONING_LEVELS: AiReasoningLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];
const DEFAULT_AGENT_REASONING_LEVEL: AiReasoningLevel = "medium";
import { readStoredCredential } from "@earendil-works/pi-coding-agent";
import { resolveRuntimePaths, type RuntimeAppConfig } from "@reflecta/server/runtime";
import { getRuntimeArg } from "./runtime-args";

export interface WindowState {
  width: number;
  height: number;
  isMaximized: boolean;
}

export interface ResolvedAiModelConfig {
  provider: AiProviderConfig;
  definition: AiProviderDefinition;
  model: AiProviderModel;
  selection: AiModelSelection;
  label: string;
}

export interface AppConfig {
  contentStorageRoot?: string;
  ai?: AiConfig;
  retrieval?: RetrievalConfig;
  windowState?: WindowState;
}

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

export function getPiAuthPath(): string {
  return path.join(getAppConfigDir(), "pi-auth.json");
}

export function isCodexAuthenticated(): boolean {
  return readStoredCredential("openai-codex", getPiAuthPath())?.type === "oauth";
}

let _cache: AppConfig | null = null;
let retrievalEmbeddingDownload: RetrievalEmbeddingDownloadStatus = {
  state: "idle",
  receivedBytes: 0,
};

const DEFAULT_RETRIEVAL_EMBEDDING_MODEL: RetrievalEmbeddingModelManifest = {
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

const AI_PROVIDER_DEFINITIONS = [
  {
    id: "openai",
    name: "OpenAI",
    piProviderId: "openai",
  },
  {
    id: "openai-codex",
    name: "Codex Subscription",
    piProviderId: "openai-codex",
    authType: "codex",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    piProviderId: "deepseek",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    piProviderId: "google",
  },
  {
    id: "xai",
    name: "xAI",
    piProviderId: "xai",
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    piProviderId: "moonshotai-cn",
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    piProviderId: "opencode",
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    piProviderId: "opencode-go",
  },
] as const;

const AI_PROVIDER_IDS = new Set<string>(AI_PROVIDER_DEFINITIONS.map((provider) => provider.id));

function isProviderConfigured(provider: AiProviderConfig): boolean {
  const definition = getAiProviderDefinition(provider.id);
  return definition.authType === "codex" ? isCodexAuthenticated() : !!provider.apiKey;
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
  const provider = providers.find(
    (item) => isProviderConfigured(item) && item.enabledModelIds.length > 0,
  );
  const modelId = provider?.enabledModelIds[0];
  return provider && modelId ? { providerId: provider.id, modelId } : undefined;
}

function hasModelSelection(config: AiConfig, selection: AiModelSelection): boolean {
  return config.providers.some(
    (provider) =>
      isProviderConfigured(provider) &&
      provider.id === selection.providerId &&
      provider.enabledModelIds.includes(selection.modelId),
  );
}

function isAiReasoningLevel(value: unknown): value is AiReasoningLevel {
  return AI_REASONING_LEVELS.includes(value as AiReasoningLevel);
}

export function normalizeAiConfig(input: AiConfig): AiConfig {
  const providerIds = new Set<string>();
  const providers = input.providers.flatMap((provider) => {
    const providerId = provider.id.trim();
    if (!providerId || !AI_PROVIDER_IDS.has(providerId)) return [];
    if (providerIds.has(providerId)) throw new Error("AI Provider ID 不能重复");
    providerIds.add(providerId);

    const definition = getAiProviderDefinition(providerId);
    const knownModelIds = new Set(definition.models.map((model) => model.id));
    const legacyModels = (provider as unknown as { models?: Array<{ id?: string }> }).models;
    const requestedModelIds = Array.isArray(provider.enabledModelIds)
      ? provider.enabledModelIds
      : (legacyModels?.map((model) => model.id ?? "") ?? []);
    const enabledModelIds = [...new Set(requestedModelIds.map((id) => id.trim()))].filter((id) =>
      knownModelIds.has(id),
    );
    return [
      {
        id: providerId,
        apiKey: provider.apiKey.trim(),
        enabledModelIds,
      },
    ];
  });

  const config = {
    providers,
    activeAgentModel: input.activeAgentModel,
    activeAgentReasoningLevel: input.activeAgentReasoningLevel,
    titleGenerationModel: input.titleGenerationModel,
  };
  const activeAgentModel =
    config.activeAgentModel && hasModelSelection(config, config.activeAgentModel)
      ? config.activeAgentModel
      : firstModelSelection(providers);
  const requestedReasoningLevel =
    (config.activeAgentReasoningLevel as unknown) === "default"
      ? "off"
      : config.activeAgentReasoningLevel;
  const activeAgentReasoningLevel = isAiReasoningLevel(requestedReasoningLevel)
    ? requestedReasoningLevel
    : undefined;
  return {
    providers,
    activeAgentModel,
    ...(activeAgentReasoningLevel ? { activeAgentReasoningLevel } : {}),
    titleGenerationModel:
      config.titleGenerationModel && hasModelSelection(config, config.titleGenerationModel)
        ? config.titleGenerationModel
        : activeAgentModel,
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

/** Path of the persisted pi.dev catalog overlay written by ModelRuntime (FileModelsStore). */
function getPiModelsStorePath(): string {
  return path.join(getAppConfigDir(), "pi-models", "models-store.json");
}

/**
 * Read the dynamic catalog overlay persisted by ModelRuntime: a map of
 * provider id -> raw model entries. Absent/partial files fall back to {}.
 */
function readDynamicModelOverrides(): Readonly<Record<string, readonly unknown[]>> {
  try {
    const raw = fs.readFileSync(getPiModelsStorePath(), "utf-8");
    const data = JSON.parse(raw) as Record<string, { models?: unknown }>;
    const overrides: Record<string, readonly unknown[]> = {};
    for (const [providerId, entry] of Object.entries(data)) {
      if (entry && Array.isArray(entry.models)) overrides[providerId] = entry.models;
    }
    return overrides;
  } catch {
    return {};
  }
}

/** Same id wins over the baseline; new ids are appended (mirrors pi's overlay merge). */
function mergeDynamicModels(
  baseline: readonly AiProviderModel[],
  dynamic: readonly unknown[],
): AiProviderModel[] {
  const merged = [...baseline];
  for (const raw of dynamic) {
    if (typeof raw !== "object" || raw === null) continue;
    const { id, name } = raw as { id?: unknown; name?: unknown };
    if (typeof id !== "string" || !id) continue;
    const model: AiProviderModel = {
      id,
      name: typeof name === "string" && name ? name : id,
      supportedReasoningLevels: getSupportedThinkingLevels(raw as Model<Api>),
    };
    const index = merged.findIndex((item) => item.id === model.id);
    if (index >= 0) merged[index] = model;
    else merged.push(model);
  }
  return merged;
}

export function getAiProviderDefinitions(): AiProviderDefinition[] {
  const dynamic = readDynamicModelOverrides();
  return AI_PROVIDER_DEFINITIONS.map((provider) => ({
    ...provider,
    models: mergeDynamicModels(
      getModels(provider.piProviderId).map((model) => ({
        id: model.id,
        name: model.name,
        supportedReasoningLevels: getSupportedThinkingLevels(model),
      })),
      dynamic[provider.piProviderId] ?? [],
    ),
  }));
}

export function getAiProviderDefinition(providerId: string): AiProviderDefinition {
  const provider = getAiProviderDefinitions().find((item) => item.id === providerId);
  if (!provider) throw new Error("不支持的 AI Provider");
  return provider;
}

export function getAiConfig(): AiConfig {
  return normalizeAiConfig(readConfig().ai ?? { providers: [] });
}

export function getRetrievalConfig(): RetrievalConfig {
  return normalizeRetrievalConfig(readConfig().retrieval);
}

function getRetrievalEmbeddingModelPath(manifest = DEFAULT_RETRIEVAL_EMBEDDING_MODEL): string {
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
    const definition = getAiProviderDefinition(provider.id);
    const modelsById = new Map(definition.models.map((model) => [model.id, model]));
    return provider.enabledModelIds.flatMap((modelId) => {
      const model = modelsById.get(modelId);
      if (!model) return [];
      return {
        providerId: provider.id,
        providerName: definition.name,
        modelId: model.id,
        modelName: model.name,
        label: `${definition.name} / ${model.name}`,
        supportedReasoningLevels: model.supportedReasoningLevels,
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

export function getActiveAgentReasoningLevel(config = getAiConfig()): AiReasoningLevel {
  const selection = getActiveAiModelSelection(config);
  if (!selection) return "off";
  return clampAiReasoningLevel(
    selection,
    config.activeAgentReasoningLevel ?? DEFAULT_AGENT_REASONING_LEVEL,
  );
}

export function clampAiReasoningLevel(
  selection: AiModelSelection,
  level: AiReasoningLevel,
): AiReasoningLevel {
  const definition = getAiProviderDefinition(selection.providerId);
  const dynamicModel = readDynamicModelOverrides()[definition.piProviderId]?.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { id?: unknown }).id === selection.modelId,
  );
  const model =
    (dynamicModel as Model<Api> | undefined) ??
    (getModels as (provider: string) => ReturnType<typeof getModels>)(definition.piProviderId).find(
      (item) => item.id === selection.modelId,
    );
  return model ? clampThinkingLevel(model, level) : "off";
}

function getTitleGenerationAiModelSelection(config = getAiConfig()): AiModelSelection | undefined {
  if (config.titleGenerationModel && hasModelSelection(config, config.titleGenerationModel)) {
    return config.titleGenerationModel;
  }
  return getActiveAiModelSelection(config);
}

export function getAiModelConfig(
  selection: AiModelSelection | undefined = undefined,
  config = getAiConfig(),
): ResolvedAiModelConfig {
  const selected = selection && hasModelSelection(config, selection) ? selection : undefined;
  const effectiveSelection = selected ?? getActiveAiModelSelection(config);
  if (!effectiveSelection) throw new Error("请先在设置中配置 AI Provider");

  const provider = config.providers.find((item) => item.id === effectiveSelection.providerId);
  const definition = provider ? getAiProviderDefinition(provider.id) : undefined;
  const model = definition?.models.find((item) => item.id === effectiveSelection.modelId);
  if (!provider || !definition || !model || !isProviderConfigured(provider)) {
    throw new Error("请先在设置中配置 AI Provider");
  }

  return {
    provider,
    definition,
    model,
    selection: effectiveSelection,
    label: `${definition.name} / ${model.name}`,
  };
}

export function getTitleGenerationAiModelConfig(config = getAiConfig()): ResolvedAiModelConfig {
  return getAiModelConfig(getTitleGenerationAiModelSelection(config), config);
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

export function getRetrievalIndexPath(): string {
  return resolveElectronRuntime(readConfig()).retrievalIndexPath;
}
