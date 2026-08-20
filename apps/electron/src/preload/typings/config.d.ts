/**
 * 配置域在 window.api 桥上的共享类型（renderer 侧经 @shared/config 引用）。
 * 单一来源是 ipc 契约中的 Effect Schema 类型，main 侧实现与之保持一致。
 */
export type { AiModelOption } from "../../ipc/contract/config";
