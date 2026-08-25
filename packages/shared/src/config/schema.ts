/**
 * config 域 wire format（Effect Schema 单一真源）。
 * ipc contract、main/config、renderer 配置类型都从这里派生，不再各自定义。
 */
import * as S from "effect/Schema";

const lit = <T extends string>(...xs: T[]) => S.Union(xs.map((x) => S.Literal(x)));

export const AiReasoningLevel = lit("off", "minimal", "low", "medium", "high", "xhigh", "max");
export type AiReasoningLevel = S.Schema.Type<typeof AiReasoningLevel>;

export const AiProviderConfig = S.Struct({
  id: S.String,
  apiKey: S.String,
  enabledModelIds: S.mutable(S.Array(S.String)),
});
export type AiProviderConfig = S.Schema.Type<typeof AiProviderConfig>;

export const AiModelSelection = S.Struct({ providerId: S.String, modelId: S.String });
export type AiModelSelection = S.Schema.Type<typeof AiModelSelection>;

export const AiConfig = S.Struct({
  providers: S.mutable(S.Array(AiProviderConfig)),
  activeAgentModel: S.optional(AiModelSelection),
  activeAgentReasoningLevel: S.optional(AiReasoningLevel),
  titleGenerationModel: S.optional(AiModelSelection),
});
export type AiConfig = S.Schema.Type<typeof AiConfig>;

export const AiProviderModel = S.Struct({
  id: S.String,
  name: S.String,
  supportedReasoningLevels: S.mutable(S.Array(AiReasoningLevel)),
});
export type AiProviderModel = S.Schema.Type<typeof AiProviderModel>;

export const AiProviderDefinition = S.Struct({
  id: S.String,
  name: S.String,
  piProviderId: S.String,
  authType: S.optional(lit("api-key", "codex")),
  models: S.mutable(S.Array(AiProviderModel)),
});
export type AiProviderDefinition = S.Schema.Type<typeof AiProviderDefinition>;

export const AiModelOption = S.Struct({
  providerId: S.String,
  providerName: S.String,
  modelId: S.String,
  modelName: S.String,
  label: S.String,
  supportedReasoningLevels: S.mutable(S.Array(AiReasoningLevel)),
});
export type AiModelOption = S.Schema.Type<typeof AiModelOption>;

export const RetrievalEmbeddingProvider = lit("disabled", "local-llama-cpp", "openai-compatible");
export type RetrievalEmbeddingProvider = S.Schema.Type<typeof RetrievalEmbeddingProvider>;

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
export type RetrievalIndexProgress = S.Schema.Type<typeof RetrievalIndexProgress>;

export const RetrievalIndexStatus = S.Struct({
  state: lit("not_ready", "indexing", "ready", "error"),
  embeddingModel: S.String,
  projectionVersion: S.Number,
  tableName: S.String,
  progress: S.optional(RetrievalIndexProgress),
  error: S.optional(S.String),
});
export type RetrievalIndexStatus = S.Schema.Type<typeof RetrievalIndexStatus>;
