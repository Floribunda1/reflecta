/**
 * P1 垂直切片 Pilot —— trash 域契约原型。
 *
 * 目的：最小可运行地证明 Effect v4 官方 rpc 机制 + typed error 跨进程式往返的可行性，
 * 为 P2 契约层 / P3 域迁移提供模板。本文件为增量原型，不接入现有 electron/ipc wiring。
 *
 * 迁移哲学：只做 pattern 验证；正式落地时（P2/P3）按 `migration-philosophy.md` 删除式收编。
 */
import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

/** 回收站条目（最小模型，正式时并入 trash/types） */
export class TrashedItem extends Schema.Class<TrashedItem>("TrashedItem")({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  deletedAt: Schema.String,
}) {}

/** 类型化错误：结构性 payload 跨 rpc 往返后可完整还原（替代现状 code:"UNKNOWN"） */
export class TrashListError extends Schema.TaggedError<TrashListError>()("TrashListError", {
  message: Schema.String,
  code: Schema.Number,
}) {}

/** 查询回收站列表：成功返回条目数组 */
export class TrashList extends Rpc.make("trash.list", {
  payload: Schema.Void,
  success: Schema.Array(TrashedItem),
  error: TrashListError,
}) {}

/** 取单条（演示 typed error 失败路径）：id === "boom" 时返回 TrashListError */
export class TrashGet extends Rpc.make("trash.get", {
  payload: { id: Schema.String },
  success: TrashedItem,
  error: TrashListError,
}) {}

/** 契约组：双端类型唯一来源 */
export const TrashContract = RpcGroup.make(TrashList, TrashGet);

/** 域程序：handler 签名由契约推导（toLayer 保证入参/成功值/错误类型正确） */
export const trashHandlers = {
  "trash.list": () =>
    Effect.succeed([
      new TrashedItem({ id: "a", title: null, deletedAt: "2026-01-01" }),
      new TrashedItem({ id: "b", title: "refactor note", deletedAt: "2026-01-02" }),
    ]),
  "trash.get": ({ id }: { id: string }) =>
    id === "boom"
      ? Effect.fail(new TrashListError({ message: `not found: ${id}`, code: 404 }))
      : Effect.succeed(new TrashedItem({ id, title: "found", deletedAt: "2026-01-03" })),
};
