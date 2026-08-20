/**
 * renderer 侧 Effect IPC client（electron-effect-rpc）。
 *
 * 单一 `window.api` 桥（preload 暴露）→ `appIpc.renderer(window.api)` 得到 per-method
 * typed client（typed domain error 进 Effect 错误通道）。组件只经本模块调用，不直接碰 bridge。
 * 迁移模式见 `docs/iterations/v2.0.0/effect-migration/migration-pattern.md`。
 */
import { appIpc } from "../../../ipc";

const { client } = appIpc.renderer(window.api);

export const rpc = {
  trashListTrashed: () => client["trash.listTrashedUnderstandings"](),
  trashRestore: (id: string) => client["trash.restoreUnderstanding"]({ id }),
  trashPermanentlyDelete: (id: string) => client["trash.permanentlyDeleteUnderstanding"]({ id }),
};
