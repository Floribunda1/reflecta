/**
 * Effect IPC 应用级共享契约（单一 `window.api` 桥，多域共用）。
 *
 * P2 契约层：各域在 `contract/` 下定义 `rpc`/错误 schema，此处汇成**一个** kit，
 * 供 main/preload/renderer 三进程复用（electron-effect-rpc 每 kit 一个 bridge global，
 * 故用单一 app kit 承载所有域，避免多全局冲突）。
 */
import { createIpcKit, defineContract } from "electron-effect-rpc";
import { PilotPing, PilotProbe } from "./pilot/contract";
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

export { TrashListError, TrashedUnderstanding } from "./contract/trash";
export { PilotBoom, PilotPing, PilotProbe } from "./pilot/contract";
export { AboutVersionInfo } from "./contract/about";
export { DomainListError } from "./contract/domain";
export type { CreateDomainInput, UpdateDomainInput, ReorderDomainItem } from "./contract/domain";

export const contract = defineContract({
  methods: [
    PilotPing,
    PilotProbe,
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
  ] as const,
  events: [] as const,
  streamMethods: [] as const,
});

/** 单一 app kit：main / preload / renderer 共用。 */
export const appIpc = createIpcKit({ contract });
