import { Effect } from "effect";
import { AppApi } from "./effect-runtime";

export const rpc = {
  trashListTrashed: () =>
    Effect.flatMap(AppApi, (client) => client["trash.listTrashedUnderstandings"]({})),
  trashRestore: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["trash.restoreUnderstanding"]({ id })),
  trashPermanentlyDelete: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["trash.permanentlyDeleteUnderstanding"]({ id })),
  trashListTrashedCanvases: () =>
    Effect.flatMap(AppApi, (client) => client["trash.listTrashedCanvases"]({})),
  trashRestoreCanvas: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["trash.restoreCanvas"]({ id })),
  trashPermanentlyDeleteCanvas: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["trash.permanentlyDeleteCanvas"]({ id })),
  aboutGetVersionInfo: () => Effect.flatMap(AppApi, (client) => client["about.getVersionInfo"]({})),
  aboutCheckForUpdates: () =>
    Effect.flatMap(AppApi, (client) => client["about.checkForUpdates"]({})),
  domainListDomains: () => Effect.flatMap(AppApi, (client) => client["domain.listDomains"]({})),
  domainGetDomainById: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["domain.getDomainById"]({ id })),
  domainCreateDomain: (input: import("../../../ipc").CreateDomainInput) =>
    Effect.flatMap(AppApi, (client) => client["domain.createDomain"]({ input })),
  domainUpdateDomain: (id: string, input: import("../../../ipc").UpdateDomainInput) =>
    Effect.flatMap(AppApi, (client) => client["domain.updateDomain"]({ id, input })),
  domainDeleteDomain: (id: string, deleteUnderstandings?: boolean) =>
    Effect.flatMap(AppApi, (client) =>
      client["domain.deleteDomain"]({ id, deleteUnderstandings: deleteUnderstandings ?? false }),
    ),
  domainReorderDomains: (items: import("../../../ipc").ReorderDomainItem[]) =>
    Effect.flatMap(AppApi, (client) => client["domain.reorderDomains"]({ items })),
  contextListByUnderstanding: (understandingId: string) =>
    Effect.flatMap(AppApi, (client) =>
      client["context.listContextsByUnderstanding"]({ understandingId }),
    ),
  contextList: (options?: { limit?: number; offset?: number }) =>
    Effect.flatMap(AppApi, (client) => client["context.listContexts"]({ options })),
  contextGetById: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["context.getContextById"]({ id })),
  contextCreate: (input: import("../../../ipc").CreateContextInput) =>
    Effect.flatMap(AppApi, (client) => client["context.createContext"]({ input })),
  contextUpdate: (id: string, input: import("../../../ipc").UpdateContextInput) =>
    Effect.flatMap(AppApi, (client) => client["context.updateContext"]({ id, input })),
  contextDelete: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["context.deleteContext"]({ id })),
  contextRestore: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["context.restoreContext"]({ id })),
  contextPermanentlyDelete: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["context.permanentlyDeleteContext"]({ id })),
  contextListTrashed: () =>
    Effect.flatMap(AppApi, (client) => client["context.listTrashedContexts"]({})),
  assetSave: (buffer: ArrayBuffer, filename: string) =>
    Effect.flatMap(AppApi, (client) =>
      client["asset.saveAsset"]({ buffer: new Uint8Array(buffer), filename }),
    ),
  assetScanOrphans: () => Effect.flatMap(AppApi, (client) => client["asset.scanOrphanAssets"]({})),
  assetCleanOrphans: (filenames: string[]) =>
    Effect.flatMap(AppApi, (client) => client["asset.cleanOrphanAssets"]({ filenames })),
  assetOpen: (filename: string) =>
    Effect.flatMap(AppApi, (client) => client["asset.openAsset"]({ filename })),
  assetOpenExternalPath: (filePath: string) =>
    Effect.flatMap(AppApi, (client) => client["asset.openExternalPath"]({ filePath })),
  assetReveal: (filename: string) =>
    Effect.flatMap(AppApi, (client) => client["asset.revealAsset"]({ filename })),
  insightsGetRecapData: () =>
    Effect.flatMap(AppApi, (client) => client["insights.getRecapData"]({})),
  searchUnderstandings: (query: string, options?: { limit?: number; offset?: number }) =>
    Effect.flatMap(AppApi, (client) => client["search.searchUnderstandings"]({ query, options })),
  searchContexts: (query: string, options?: { limit?: number; offset?: number }) =>
    Effect.flatMap(AppApi, (client) => client["search.searchContexts"]({ query, options })),
  searchSearch: (query: string, options?: { limit?: number; offset?: number }) =>
    Effect.flatMap(AppApi, (client) => client["search.search"]({ query, options })),
  understandingList: (filter?: import("../../../ipc").ListUnderstandingsFilter) =>
    Effect.flatMap(AppApi, (client) => client["understanding.listUnderstandings"]({ filter })),
  understandingGetById: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["understanding.getUnderstandingById"]({ id })),
  understandingCreate: (input: import("../../../ipc").CreateUnderstandingInput) =>
    Effect.flatMap(AppApi, (client) => client["understanding.createUnderstanding"]({ input })),
  understandingUpdate: (id: string, input: import("../../../ipc").UpdateUnderstandingInput) =>
    Effect.flatMap(AppApi, (client) => client["understanding.updateUnderstanding"]({ id, input })),
  understandingDelete: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["understanding.deleteUnderstanding"]({ id })),
  canvasList: () =>
    Effect.flatMap(AppApi, (client) => client["understandingCanvas.listCanvases"]({})),
  canvasListByUnderstanding: (understandingId: string) =>
    Effect.flatMap(AppApi, (client) =>
      client["understandingCanvas.listCanvasesByUnderstanding"]({ understandingId }),
    ),
  canvasGet: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["understandingCanvas.getCanvas"]({ id })),
  canvasListByIds: (ids: string[]) =>
    Effect.flatMap(AppApi, (client) => client["understandingCanvas.listCanvasesByIds"]({ ids })),
  canvasCreate: (input?: import("../../../ipc").CreateCanvasInput) =>
    Effect.flatMap(AppApi, (client) => client["understandingCanvas.createCanvas"]({ input })),
  canvasUpdate: (id: string, input: import("../../../ipc").UpdateCanvasInput) =>
    Effect.flatMap(AppApi, (client) => client["understandingCanvas.updateCanvas"]({ id, input })),
  canvasDelete: (id: string) =>
    Effect.flatMap(AppApi, (client) => client["understandingCanvas.deleteCanvas"]({ id })),
  canvasSave: (canvasId: string, document: import("../../../ipc").CanvasDocument) =>
    Effect.flatMap(AppApi, (client) =>
      client["understandingCanvas.saveCanvas"]({ canvasId, document }),
    ),
  canvasUpdateViewport: (canvasId: string, viewport: import("../../../ipc").Viewport) =>
    Effect.flatMap(AppApi, (client) =>
      client["understandingCanvas.updateViewport"]({ canvasId, viewport }),
    ),
  configOpenDirPicker: () =>
    Effect.flatMap(AppApi, (client) => client["config.openDirectoryPicker"]({})),
  configSetStorageRoot: (newPath: string) =>
    Effect.flatMap(AppApi, (client) => client["config.setContentStorageRoot"]({ newPath })),
  configRestart: () => Effect.flatMap(AppApi, (client) => client["config.restartApp"]({})),
  configGet: () => Effect.flatMap(AppApi, (client) => client["config.getConfig"]({})),
  configGetAi: () => Effect.flatMap(AppApi, (client) => client["config.getAiConfig"]({})),
  configSetAi: (config: import("../../../ipc").AiConfig) =>
    Effect.flatMap(AppApi, (client) => client["config.setAiConfig"]({ config })),
  configGetCodexAuth: () =>
    Effect.flatMap(AppApi, (client) => client["config.getCodexAuthStatus"]({})),
  configConnectCodex: () => Effect.flatMap(AppApi, (client) => client["config.connectCodex"]({})),
  configDisconnectCodex: () =>
    Effect.flatMap(AppApi, (client) => client["config.disconnectCodex"]({})),
  configGetRetrieval: () =>
    Effect.flatMap(AppApi, (client) => client["config.getRetrievalConfig"]({})),
  configSetRetrieval: (config: import("../../../ipc").RetrievalConfig) =>
    Effect.flatMap(AppApi, (client) => client["config.setRetrievalConfig"]({ config })),
  configGetEmbeddingStatus: () =>
    Effect.flatMap(AppApi, (client) => client["config.getRetrievalEmbeddingModelStatus"]({})),
  configDownloadModel: () =>
    Effect.flatMap(AppApi, (client) => client["config.downloadDefaultRetrievalEmbeddingModel"]({})),
  configGetIndexStatus: () =>
    Effect.flatMap(AppApi, (client) => client["config.getRetrievalIndexStatus"]({})),
  configRebuildIndex: () =>
    Effect.flatMap(AppApi, (client) => client["config.rebuildRetrievalIndex"]({})),
  configListModelOptions: () =>
    Effect.flatMap(AppApi, (client) => client["config.listAiModelOptions"]({})),
  configListProviderDefs: () =>
    Effect.flatMap(AppApi, (client) => client["config.listAiProviderDefinitions"]({})),
  configRefreshModels: () =>
    Effect.flatMap(AppApi, (client) => client["config.refreshAiModels"]({})),
  configGetActiveModel: () =>
    Effect.flatMap(AppApi, (client) => client["config.getActiveAgentModel"]({})),
  configGetReasoningLevel: () =>
    Effect.flatMap(AppApi, (client) => client["config.getActiveAgentReasoningLevel"]({})),
  configSetActiveModel: (selection: import("../../../ipc").AiModelSelection) =>
    Effect.flatMap(AppApi, (client) => client["config.setActiveAgentModel"]({ selection })),
  configSetReasoningLevel: (level: import("../../../ipc").AiReasoningLevel) =>
    Effect.flatMap(AppApi, (client) => client["config.setActiveAgentReasoningLevel"]({ level })),
  chatListThreads: () => Effect.flatMap(AppApi, (client) => client["chat.listThreads"]({})),
  chatListSkills: () => Effect.flatMap(AppApi, (client) => client["chat.listSkills"]({})),
  chatCreateThread: (title?: string) =>
    Effect.flatMap(AppApi, (client) => client["chat.createThread"]({ title })),
  chatRenameThread: (threadId: string, title: string) =>
    Effect.flatMap(AppApi, (client) => client["chat.renameThread"]({ threadId, title })),
  chatGenerateTitle: (threadId: string) =>
    Effect.flatMap(AppApi, (client) => client["chat.generateThreadTitle"]({ threadId })),
  chatArchiveThread: (threadId: string) =>
    Effect.flatMap(AppApi, (client) => client["chat.archiveThread"]({ threadId })),
  chatDeleteThread: (threadId: string) =>
    Effect.flatMap(AppApi, (client) => client["chat.deleteThread"]({ threadId })),
  chatForkFromMessage: (threadId: string, messageId: string) =>
    Effect.flatMap(AppApi, (client) =>
      client["chat.forkThreadFromMessage"]({ threadId, messageId }),
    ),
  chatExportMarkdown: (filename: string, markdown: string) =>
    Effect.flatMap(AppApi, (client) => client["chat.exportMarkdown"]({ filename, markdown })),
  chatReadProjection: (sessionId: string) =>
    Effect.flatMap(AppApi, (client) => client["chat.readSessionProjection"]({ sessionId })),
  chatSendCommand: (command: import("../../../ipc").AgentCommand) =>
    Effect.flatMap(AppApi, (client) => client["chat.sendAgentCommand"]({ command })),
};
