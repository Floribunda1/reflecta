/**
 * Effect IPC 应用级共享契约（单一 `window.api` 桥，多域共用）。
 *
 * P2 契约层：各域在 `contract/` 下定义 `rpc`/错误 schema，此处汇成**一个** kit，
 * 供 main/preload/renderer 三进程复用（electron-effect-rpc 每 kit 一个 bridge global，
 * 故用单一 app kit 承载所有域，避免多全局冲突）。
 */
import { createIpcKit, defineContract } from "electron-effect-rpc";
import { TrashListTrashed, TrashRestore, TrashPermanentlyDelete } from "./contract/trash";
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
export { AboutVersionInfo } from "./contract/about";
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
} from "./contract/chat";
export type {
  AiConfig,
  AiModelOption,
  AiModelSelection,
  AiProviderDefinition,
  AiReasoningLevel,
  RetrievalConfig,
  RetrievalEmbeddingModelStatus,
  RetrievalIndexStatus,
} from "./contract/config";
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

export const contract = defineContract({
  methods: [
    TrashListTrashed,
    TrashRestore,
    TrashPermanentlyDelete,
    AboutGetVersionInfo,
    AboutCheckForUpdates,
    DomainList,
    DomainGetById,
    DomainReorder,
    DomainCreate,
    DomainUpdate,
    DomainDelete,
    ContextListByUnderstanding,
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
  ] as const,
  events: [] as const,
  streamMethods: [] as const,
});

/** 单一 app kit：main / preload / renderer 共用。 */
export const appIpc = createIpcKit({ contract });
