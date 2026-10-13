/** config 域契约（迁移批：config，Round C）。22 方法、全套 AI/检索配置类型。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";

export class ConfigError extends S.TaggedError<ConfigError>()("ConfigError", {
  reason: S.String,
  code: S.Number,
}) {}

import {
  AiReasoningLevel,
  AiModelSelection,
  AiConfig,
  AiProviderDefinition,
  AiModelOption,
  RetrievalConfig,
  RetrievalEmbeddingModelStatus,
  RetrievalIndexStatus,
} from "@reflecta/shared";

type NoCtx<A> = S.Codec<A, unknown, never, never>;
const noCtx = <A>(schema: S.Schema<A>): NoCtx<A> => schema as unknown as NoCtx<A>;

export const ContentStorageConfig = S.Struct({
  contentStorageRoot: S.String,
  isCustomContentStorageRoot: S.Boolean,
});
export type ContentStorageConfig = S.Schema.Type<typeof ContentStorageConfig>;

export const ConfigOpenDirPicker = Rpc.make("config.openDirectoryPicker", {
  payload: S.Struct({}),
  success: S.NullOr(S.String),
  error: ConfigError,
});
export const ConfigSetStorageRoot = Rpc.make("config.setContentStorageRoot", {
  payload: S.Struct({ newPath: S.String }),
  success: S.Void,
  error: ConfigError,
});
export const ConfigRestart = Rpc.make("config.restartApp", {
  payload: S.Struct({}),
  success: S.Void,
  error: ConfigError,
});
export const ConfigGet = Rpc.make("config.getConfig", {
  payload: S.Struct({}),
  success: ContentStorageConfig,
  error: ConfigError,
});
export const ConfigGetAi = Rpc.make("config.getAiConfig", {
  payload: S.Struct({}),
  success: AiConfig,
  error: ConfigError,
});
export const ConfigSetAi = Rpc.make("config.setAiConfig", {
  payload: S.Struct({ config: AiConfig }),
  success: S.Void,
  error: ConfigError,
});
export const ConfigGetCodexAuth = Rpc.make("config.getCodexAuthStatus", {
  payload: S.Struct({}),
  success: S.Boolean,
  error: ConfigError,
});
export const ConfigConnectCodex = Rpc.make("config.connectCodex", {
  payload: S.Struct({}),
  success: S.Boolean,
  error: ConfigError,
});
export const ConfigDisconnectCodex = Rpc.make("config.disconnectCodex", {
  payload: S.Struct({}),
  success: S.Void,
  error: ConfigError,
});
export const ConfigGetRetrieval = Rpc.make("config.getRetrievalConfig", {
  payload: S.Struct({}),
  success: RetrievalConfig,
  error: ConfigError,
});
export const ConfigSetRetrieval = Rpc.make("config.setRetrievalConfig", {
  payload: S.Struct({ config: RetrievalConfig }),
  success: S.Void,
  error: ConfigError,
});
export const ConfigGetEmbeddingStatus = Rpc.make("config.getRetrievalEmbeddingModelStatus", {
  payload: S.Struct({}),
  success: RetrievalEmbeddingModelStatus,
  error: ConfigError,
});
export const ConfigDownloadModel = Rpc.make("config.downloadDefaultRetrievalEmbeddingModel", {
  payload: S.Struct({}),
  success: RetrievalEmbeddingModelStatus,
  error: ConfigError,
});
export const ConfigGetIndexStatus = Rpc.make("config.getRetrievalIndexStatus", {
  payload: S.Struct({}),
  success: noCtx(RetrievalIndexStatus),
  error: ConfigError,
});
export const ConfigRebuildIndex = Rpc.make("config.rebuildRetrievalIndex", {
  payload: S.Struct({}),
  success: noCtx(RetrievalIndexStatus),
  error: ConfigError,
});
export const ConfigListModelOptions = Rpc.make("config.listAiModelOptions", {
  payload: S.Struct({}),
  success: S.Array(AiModelOption),
  error: ConfigError,
});
export const ConfigListProviderDefs = Rpc.make("config.listAiProviderDefinitions", {
  payload: S.Struct({}),
  success: S.Array(AiProviderDefinition),
  error: ConfigError,
});

export const ConfigRefreshModels = Rpc.make("config.refreshAiModels", {
  payload: S.Struct({}),
  success: S.Array(AiProviderDefinition),
  error: ConfigError,
});
export const ConfigGetActiveModel = Rpc.make("config.getActiveAgentModel", {
  payload: S.Struct({}),
  success: S.NullOr(AiModelSelection),
  error: ConfigError,
});
export const ConfigGetReasoningLevel = Rpc.make("config.getActiveAgentReasoningLevel", {
  payload: S.Struct({}),
  success: AiReasoningLevel,
  error: ConfigError,
});
export const ConfigSetActiveModel = Rpc.make("config.setActiveAgentModel", {
  payload: S.Struct({ selection: AiModelSelection }),
  success: AiReasoningLevel,
  error: ConfigError,
});
export const ConfigSetReasoningLevel = Rpc.make("config.setActiveAgentReasoningLevel", {
  payload: S.Struct({ level: AiReasoningLevel }),
  success: S.Void,
  error: ConfigError,
});
