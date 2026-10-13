import { RpcGroup } from "effect/rpc";
import {
  TrashListTrashed,
  TrashRestore,
  TrashPermanentlyDelete,
  TrashListTrashedCanvases,
  TrashRestoreCanvas,
  TrashPermanentlyDeleteCanvas,
} from "./contract/trash";
import { AboutGetVersionInfo, AboutCheckForUpdates } from "./contract/about";
import {
  DomainList,
  DomainGetById,
  DomainReorder,
  DomainCreate,
  DomainUpdate,
  DomainDelete,
} from "./contract/domain";
import {
  ContextListByUnderstanding,
  ContextList,
  ContextGetById,
  ContextCreate,
  ContextUpdate,
  ContextDelete,
  ContextRestore,
  ContextPermanentlyDelete,
  ContextListTrashed,
} from "./contract/context";
import {
  AssetSave,
  AssetScanOrphans,
  AssetCleanOrphans,
  AssetOpen,
  AssetOpenExternalPath,
  AssetReveal,
} from "./contract/asset";
import { CanvasExportPng } from "./contract/canvas";
import { DiagnosticsGetLogFilePath, DiagnosticsShowLogFile } from "./contract/diagnostics";
import { SearchUnderstandings, SearchContexts, SearchSearch } from "./contract/search";
import { InsightsGetRecapData } from "./contract/insights";
import {
  UnderstandingList,
  UnderstandingGetById,
  UnderstandingCreate,
  UnderstandingUpdate,
  UnderstandingDelete,
  UnderstandingRestore,
  UnderstandingPermanentlyDelete,
} from "./contract/understanding";
import {
  CanvasList,
  CanvasListByUnderstanding,
  CanvasGet,
  CanvasListByIds,
  CanvasCreate,
  CanvasUpdate,
  CanvasDelete,
  CanvasUpdateViewport,
  CanvasSave,
} from "./contract/understanding-canvas";
import {
  ConfigOpenDirPicker,
  ConfigSetStorageRoot,
  ConfigRestart,
  ConfigGet,
  ConfigGetAi,
  ConfigSetAi,
  ConfigGetCodexAuth,
  ConfigConnectCodex,
  ConfigDisconnectCodex,
  ConfigGetRetrieval,
  ConfigSetRetrieval,
  ConfigGetEmbeddingStatus,
  ConfigDownloadModel,
  ConfigGetIndexStatus,
  ConfigRebuildIndex,
  ConfigListModelOptions,
  ConfigListProviderDefs,
  ConfigRefreshModels,
  ConfigGetActiveModel,
  ConfigGetReasoningLevel,
  ConfigSetActiveModel,
  ConfigSetReasoningLevel,
} from "./contract/config";
import {
  ChatListThreads,
  ChatListSkills,
  ChatCreateThread,
  ChatRenameThread,
  ChatGenerateTitle,
  ChatArchiveThread,
  ChatDeleteThread,
  ChatForkFromMessage,
  ChatExportMarkdown,
  ChatReadProjection,
  ChatSendCommand,
} from "./contract/chat";

export { TrashListError, TrashedUnderstanding } from "./contract/trash";
export type { AboutVersionInfo } from "@reflecta/shared";
export { ContextListError } from "./contract/context";
export { AssetError } from "./contract/asset";
export { CanvasExportError } from "./contract/canvas";
export { SearchError } from "./contract/search";
export { InsightsError } from "./contract/insights";
export { UnderstandingError } from "./contract/understanding";
export { CanvasError } from "./contract/understanding-canvas";
export { ConfigError } from "./contract/config";
export { ChatError } from "./contract/chat";
export type {
  AgentCommand,
  AgentSessionProjection,
  AgentSessionSummary,
  AgentSkillSummary,
} from "@reflecta/shared";
export type {
  AiConfig,
  AiModelOption,
  AiModelSelection,
  AiProviderDefinition,
  AiReasoningLevel,
  RetrievalConfig,
  RetrievalEmbeddingModelStatus,
} from "@reflecta/shared";
export type { RetrievalIndexStatus } from "@reflecta/shared";
export type {
  CreateCanvasInput,
  UpdateCanvasInput,
  CanvasDocument,
  Viewport,
  CanvasDTO,
  CanvasDetailDTO,
  CanvasEdgeDTO,
  CanvasElementDTO,
} from "./contract/understanding-canvas";
export type {
  CreateUnderstandingInput,
  UpdateUnderstandingInput,
  ListUnderstandingsFilter,
} from "./contract/understanding";
export { DomainListError } from "./contract/domain";
export type { CreateDomainInput, UpdateDomainInput, ReorderDomainItem } from "./contract/domain";
export type { CreateContextInput, UpdateContextInput, TrashedContextDTO } from "./contract/context";

export const AppRpcs = RpcGroup.make(
  TrashListTrashed,
  TrashRestore,
  TrashPermanentlyDelete,
  TrashListTrashedCanvases,
  TrashRestoreCanvas,
  TrashPermanentlyDeleteCanvas,
  AboutGetVersionInfo,
  AboutCheckForUpdates,
  DomainList,
  DomainGetById,
  DomainReorder,
  DomainCreate,
  DomainUpdate,
  DomainDelete,
  ContextListByUnderstanding,
  ContextList,
  ContextGetById,
  ContextCreate,
  ContextUpdate,
  ContextDelete,
  ContextRestore,
  ContextPermanentlyDelete,
  ContextListTrashed,
  AssetSave,
  AssetScanOrphans,
  AssetCleanOrphans,
  AssetOpen,
  AssetOpenExternalPath,
  AssetReveal,
  CanvasExportPng,
  DiagnosticsGetLogFilePath,
  DiagnosticsShowLogFile,
  SearchUnderstandings,
  SearchContexts,
  SearchSearch,
  InsightsGetRecapData,
  UnderstandingList,
  UnderstandingGetById,
  UnderstandingCreate,
  UnderstandingUpdate,
  UnderstandingDelete,
  UnderstandingRestore,
  UnderstandingPermanentlyDelete,
  CanvasList,
  CanvasListByUnderstanding,
  CanvasGet,
  CanvasListByIds,
  CanvasCreate,
  CanvasUpdate,
  CanvasDelete,
  CanvasUpdateViewport,
  CanvasSave,
  ConfigOpenDirPicker,
  ConfigSetStorageRoot,
  ConfigRestart,
  ConfigGet,
  ConfigGetAi,
  ConfigSetAi,
  ConfigGetCodexAuth,
  ConfigConnectCodex,
  ConfigDisconnectCodex,
  ConfigGetRetrieval,
  ConfigSetRetrieval,
  ConfigGetEmbeddingStatus,
  ConfigDownloadModel,
  ConfigGetIndexStatus,
  ConfigRebuildIndex,
  ConfigListModelOptions,
  ConfigListProviderDefs,
  ConfigRefreshModels,
  ConfigGetActiveModel,
  ConfigGetReasoningLevel,
  ConfigSetActiveModel,
  ConfigSetReasoningLevel,
  ChatListThreads,
  ChatListSkills,
  ChatCreateThread,
  ChatRenameThread,
  ChatGenerateTitle,
  ChatArchiveThread,
  ChatDeleteThread,
  ChatForkFromMessage,
  ChatExportMarkdown,
  ChatReadProjection,
  ChatSendCommand,
);
