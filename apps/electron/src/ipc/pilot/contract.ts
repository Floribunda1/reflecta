/**
 * P1 垂直切片 —— Effect IPC pilot 共享契约（electron-effect-rpc）。
 *
 * 目的：用一条最小的、增量加入的 Effects IPC 通道，端到端验证
 * electron-effect-rpc 在 Reflecta 的 main→preload→renderer 三进程上跑通，
 * 重点是 typed domain error 跨进程结构化往返。
 *
 * 本契约只服务于验证，不承载业务；真实域迁移时按总纲删除式扩充到 `contract/` 下。
 */
import * as S from "effect/Schema";
import { createIpcKit, defineContract, rpc } from "electron-effect-rpc";

/** 类型化域错误：跨进程往返后结构（reason/code）完整还原。 */
export class PilotBoom extends S.TaggedError<PilotBoom>()("PilotBoom", {
  reason: S.String,
  code: S.Number,
}) {}

/** 无障碍探活：Ping 成功路径。 */
export const PilotPing = rpc("PilotPing", S.Struct({}), S.Struct({ message: S.String }));

/** 演示 typed error：id === "boom" 时返回 PilotBoom。 */
export const PilotProbe = rpc(
  "PilotProbe",
  S.Struct({ id: S.String }),
  S.Struct({ id: S.String, ok: S.Boolean }),
  PilotBoom,
);

const contract = defineContract({
  methods: [PilotPing, PilotProbe] as const,
  events: [] as const,
  streamMethods: [] as const,
});

/** 一处契约，main / preload / renderer 三进程复用。 */
export const pilotIpc = createIpcKit({ contract });
