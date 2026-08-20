/** config 域契约（迁移批：config，Round C）。22 方法、全套 AI/检索配置类型。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export class ConfigError extends S.TaggedError<ConfigError>()("ConfigError", {
  reason: S.String,
  code: S.Number,
}) {}

const lit = <T extends string>(...xs: T[]) => S.Union(xs.map((x) => S.Literal(x)));
type NoCtx<A> = S.Codec<A, unknown, never, never>;
const noCtx = <A>(schema: S.Schema<A>): NoCtx<A> => schema as unknown as NoCtx<A>;

export const AiReasoningLevel = lit("off", "minimal", "low", "medium", "high", "xhigh", "max");
export type AiReasoningLevel = S.Schema.Type<typeof AiReasoningLevel>;

export const AiProviderConfig = S.Struct({
  id: S.String,
  apiKey: S.String,
  enabledModelIds: S.Array(S.String),
});
export type AiProviderConfig = S.Schema.Type<typeof AiProviderConfig>;

export const AiModelSelection = S.Struct({ providerId: S.String, modelId: S.String });
export type AiModelSelection = S.Schema.Type<typeof AiModelSelection>;

export const AiConfig = S.Struct({
  providers: S.Array(AiProviderConfig),
  activeAgentModel: S.optional(AiModelSelection),
  activeAgentReasoningLevel: S.optional(AiReasoningLevel),
  titleGenerationModel: S.optional(AiModelSelection),
});
export type AiConfig = S.Schema.Type<typeof AiConfig>;

export const AiProviderModel = S.Struct({
  id: S.String,
  name: S.String,
  supportedReasoningLevels: S.Array(AiReasoningLevel),
});
export type AiProviderModel = S.Schema.Type<typeof AiProviderModel>;

export const AiProviderDefinition = S.Struct({
  id: S.String,
  name: S.String,
  piProviderId: S.String,
  authType: S.optional(lit("api-key", "codex")),
  models: S.Array(AiProviderModel),
});
export type AiProviderDefinition = S.Schema.Type<typeof AiProviderDefinition>;

export const AiModelOption = S.Struct({
  providerId: S.String,
  providerName: S.String,
  modelId: S.String,
  modelName: S.String,
  label: S.String,
  supportedReasoningLevels: S.Array(AiReasoningLevel),
});
export type AiModelOption = S.Schema.Type<typeof AiModelOption>;

export const RetrievalEmbeddingProvider = lit("disabled", "local-llama-cpp", "openai-compatible");

export const RetrievalEmbeddingConfig = S.Struct({
  provider: RetrievalEmbeddingProvider,
  modelId: S.String,
  baseUrl: S.optional(S.String),
  apiKey: S.optional(S.String),
  modelPath: S.optional(S.String),
});
export type RetrievalEmbeddingConfig = S.Schema.Type<typeof RetrievalEmbeddingConfig>;

export const RetrievalConfig = S.Struct({ embedding: RetrievalEmbeddingConfig });
export type RetrievalConfig = S.Schema.Type<typeof RetrievalConfig>;

export const RetrievalEmbeddingDownloadStatus = S.Struct({
  state: lit("idle", "downloading", "downloaded", "error"),
  receivedBytes: S.Number,
  totalBytes: S.optional(S.Number),
  percent: S.optional(S.Number),
  error: S.optional(S.String),
});
export type RetrievalEmbeddingDownloadStatus = S.Schema.Type<
  typeof RetrievalEmbeddingDownloadStatus
>;

export const RetrievalEmbeddingModelManifest = S.Struct({
  id: S.String,
  name: S.String,
  runtime: S.Literal("llama.cpp"),
  modelId: S.String,
  repoId: S.String,
  fileName: S.String,
  downloadUrl: S.String,
  dimensions: S.Number,
  sizeLabel: S.String,
});
export type RetrievalEmbeddingModelManifest = S.Schema.Type<typeof RetrievalEmbeddingModelManifest>;

export const RetrievalEmbeddingModelStatus = S.Struct({
  manifest: RetrievalEmbeddingModelManifest,
  downloaded: S.Boolean,
  modelPath: S.String,
  config: RetrievalConfig,
  download: RetrievalEmbeddingDownloadStatus,
});
export type RetrievalEmbeddingModelStatus = S.Schema.Type<typeof RetrievalEmbeddingModelStatus>;

export const RetrievalIndexProgress = S.Struct({
  phase: S.optional(S.String),
  completed: S.Number,
  total: S.Number,
  percent: S.Number,
});
export const RetrievalIndexStatus = S.Struct({
  state: lit("not_ready", "indexing", "ready", "error"),
  embeddingModel: S.String,
  projectionVersion: S.Number,
  tableName: S.String,
  progress: S.optional(RetrievalIndexProgress),
  error: S.optional(S.String),
});
export type RetrievalIndexStatus = S.Schema.Type<typeof RetrievalIndexStatus>;

export const ContentStorageConfig = S.Struct({
  contentStorageRoot: S.String,
  isCustomContentStorageRoot: S.Boolean,
});
export type ContentStorageConfig = S.Schema.Type<typeof ContentStorageConfig>;

export const ConfigOpenDirPicker = rpc(
  "config.openDirectoryPicker",
  S.Struct({}),
  S.NullOr(S.String),
  ConfigError,
);
export const ConfigSetStorageRoot = rpc(
  "config.setContentStorageRoot",
  S.Struct({ newPath: S.String }),
  S.Void,
  ConfigError,
);
export const ConfigRestart = rpc("config.restartApp", S.Struct({}), S.Void, ConfigError);
export const ConfigGet = rpc("config.getConfig", S.Struct({}), ContentStorageConfig, ConfigError);
export const ConfigGetAi = rpc("config.getAiConfig", S.Struct({}), AiConfig, ConfigError);
export const ConfigSetAi = rpc(
  "config.setAiConfig",
  S.Struct({ config: AiConfig }),
  S.Void,
  ConfigError,
);
export const ConfigGetCodexAuth = rpc(
  "config.getCodexAuthStatus",
  S.Struct({}),
  S.Boolean,
  ConfigError,
);
export const ConfigConnectCodex = rpc("config.connectCodex", S.Struct({}), S.Boolean, ConfigError);
export const ConfigDisconnectCodex = rpc(
  "config.disconnectCodex",
  S.Struct({}),
  S.Void,
  ConfigError,
);
export const ConfigGetRetrieval = rpc(
  "config.getRetrievalConfig",
  S.Struct({}),
  RetrievalConfig,
  ConfigError,
);
export const ConfigSetRetrieval = rpc(
  "config.setRetrievalConfig",
  S.Struct({ config: RetrievalConfig }),
  S.Void,
  ConfigError,
);
export const ConfigGetEmbeddingStatus = rpc(
  "config.getRetrievalEmbeddingModelStatus",
  S.Struct({}),
  RetrievalEmbeddingModelStatus,
  ConfigError,
);
export const ConfigDownloadModel = rpc(
  "config.downloadDefaultRetrievalEmbeddingModel",
  S.Struct({}),
  RetrievalEmbeddingModelStatus,
  ConfigError,
);
export const ConfigGetIndexStatus = rpc(
  "config.getRetrievalIndexStatus",
  S.Struct({}),
  noCtx(RetrievalIndexStatus),
  ConfigError,
);
export const ConfigRebuildIndex = rpc(
  "config.rebuildRetrievalIndex",
  S.Struct({}),
  noCtx(RetrievalIndexStatus),
  ConfigError,
);
export const ConfigListModelOptions = rpc(
  "config.listAiModelOptions",
  S.Struct({}),
  S.Array(AiModelOption),
  ConfigError,
);
export const ConfigListProviderDefs = rpc(
  "config.listAiProviderDefinitions",
  S.Struct({}),
  S.Array(AiProviderDefinition),
  ConfigError,
);
export const ConfigGetActiveModel = rpc(
  "config.getActiveAgentModel",
  S.Struct({}),
  S.NullOr(AiModelSelection),
  ConfigError,
);
export const ConfigGetReasoningLevel = rpc(
  "config.getActiveAgentReasoningLevel",
  S.Struct({}),
  AiReasoningLevel,
  ConfigError,
);
export const ConfigSetActiveModel = rpc(
  "config.setActiveAgentModel",
  S.Struct({ selection: AiModelSelection }),
  AiReasoningLevel,
  ConfigError,
);
export const ConfigSetReasoningLevel = rpc(
  "config.setActiveAgentReasoningLevel",
  S.Struct({ level: AiReasoningLevel }),
  S.Void,
  ConfigError,
);
