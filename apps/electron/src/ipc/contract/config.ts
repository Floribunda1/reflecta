/** config 域契约（迁移批：config，Round C）。22 方法、全套 AI/检索配置类型。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

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

export const ConfigRefreshModels = rpc(
  "config.refreshAiModels",
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
