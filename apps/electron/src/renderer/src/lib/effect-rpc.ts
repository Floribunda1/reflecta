/**
 * renderer 侧 Effect IPC client（electron-effect-rpc）。
 *
 * 单一 `window.api` 桥（preload 暴露）→ `appIpc.renderer(window.api)` 得到 per-method
 * typed client（typed domain error 进 Effect 错误通道）。组件只经本模块调用，不直接碰 bridge。
 * 迁移模式见 `docs/iterations/v2.0.0/effect-migration/migration-pattern.md`。
 */
import { appIpc } from "../../../ipc";

// renderer 在真实 app 中 window.api 由 preload 注入；测试环境无 window.api 时不构造 client。
const bridge = (window as { api?: unknown }).api as
  | import("electron-effect-rpc").IpcBridge
  | undefined;
const client = bridge
  ? appIpc.renderer(bridge).client
  : (null as unknown as ReturnType<typeof appIpc.renderer>["client"]);

export const rpc = {
  trashListTrashed: () => client["trash.listTrashedUnderstandings"](),
  trashRestore: (id: string) => client["trash.restoreUnderstanding"]({ id }),
  trashPermanentlyDelete: (id: string) => client["trash.permanentlyDeleteUnderstanding"]({ id }),
  aboutGetVersionInfo: () => client["about.getVersionInfo"](),
  aboutCheckForUpdates: () => client["about.checkForUpdates"](),
  domainListDomains: () => client["domain.listDomains"](),
  domainGetDomainById: (id: string) => client["domain.getDomainById"]({ id }),
  domainCreateDomain: (input: import("../../../ipc").CreateDomainInput) =>
    client["domain.createDomain"]({ input }),
  domainUpdateDomain: (id: string, input: import("../../../ipc").UpdateDomainInput) =>
    client["domain.updateDomain"]({ id, input }),
  domainDeleteDomain: (id: string, deleteUnderstandings?: boolean) =>
    client["domain.deleteDomain"]({ id, deleteUnderstandings: deleteUnderstandings ?? false }),
  domainReorderDomains: (items: import("../../../ipc").ReorderDomainItem[]) =>
    client["domain.reorderDomains"]({ items }),
  contextListByUnderstanding: (understandingId: string) =>
    client["context.listContextsByUnderstanding"]({ understandingId }),
  contextGetById: (id: string) => client["context.getContextById"]({ id }),
  contextCreate: (input: import("../../../ipc").CreateContextInput) =>
    client["context.createContext"]({ input }),
  contextUpdate: (id: string, input: import("../../../ipc").UpdateContextInput) =>
    client["context.updateContext"]({ id, input }),
  contextDelete: (id: string) => client["context.deleteContext"]({ id }),
  contextRestore: (id: string) => client["context.restoreContext"]({ id }),
  contextPermanentlyDelete: (id: string) => client["context.permanentlyDeleteContext"]({ id }),
  contextListTrashed: () => client["context.listTrashedContexts"](),
  assetSave: (buffer: ArrayBuffer, filename: string) =>
    client["asset.saveAsset"]({ buffer: new Uint8Array(buffer), filename }),
  assetScanOrphans: () => client["asset.scanOrphanAssets"](),
  assetCleanOrphans: (filenames: string[]) => client["asset.cleanOrphanAssets"]({ filenames }),
  assetOpen: (filename: string) => client["asset.openAsset"]({ filename }),
  assetOpenExternalPath: (filePath: string) => client["asset.openExternalPath"]({ filePath }),
  assetReveal: (filename: string) => client["asset.revealAsset"]({ filename }),
  insightsGetRecapData: () => client["insights.getRecapData"](),
  searchUnderstandings: (query: string, options?: { limit?: number; offset?: number }) =>
    client["search.searchUnderstandings"]({ query, options }),
  searchContexts: (query: string, options?: { limit?: number; offset?: number }) =>
    client["search.searchContexts"]({ query, options }),
  searchSearch: (query: string, options?: { limit?: number; offset?: number }) =>
    client["search.search"]({ query, options }),
};
