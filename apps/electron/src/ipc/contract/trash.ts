/**
 * trash 域契约（删除式迁移 P3.1 / P2 契约层）。
 *
 * 首个真实域迁移模板：typed domain error `TrashListError` 进契约，跨进程结构化往返。
 * 方法形状对齐现有 @app 主进程 `TrashService`（listTrashed/restore/permanentlyDelete）。
 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";

/** 回收站理解条目（对齐现有 TrashedUnderstandingDTO 形状；用宽松 Struct，额外字段忽略）。 */
export const TrashedUnderstanding = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.NullOr(S.String),
  deletedAt: S.String,
});
export type TrashedUnderstanding = S.Schema.Type<typeof TrashedUnderstanding>;

/** 类型化域错误 */
export class TrashListError extends S.TaggedError<TrashListError>()("TrashListError", {
  reason: S.String,
  code: S.Number,
}) {}

/** 列出回收站理解；成功返回条目数组 */
export const TrashListTrashed = Rpc.make("trash.listTrashedUnderstandings", {
  payload: S.Struct({}),
  success: S.Array(TrashedUnderstanding),
  error: TrashListError,
});

/** 还原理解 */
export const TrashRestore = Rpc.make("trash.restoreUnderstanding", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: TrashListError,
});

/** 永久删除理解 */
export const TrashPermanentlyDelete = Rpc.make("trash.permanentlyDeleteUnderstanding", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: TrashListError,
});

/** 回收站画布条目 */
export const TrashedCanvas = S.Struct({
  id: S.String,
  title: S.String,
  deletedAt: S.String,
});
export type TrashedCanvas = S.Schema.Type<typeof TrashedCanvas>;

/** 列出回收站画布 */
export const TrashListTrashedCanvases = Rpc.make("trash.listTrashedCanvases", {
  payload: S.Struct({}),
  success: S.Array(TrashedCanvas),
  error: TrashListError,
});

/** 还原画布 */
export const TrashRestoreCanvas = Rpc.make("trash.restoreCanvas", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: TrashListError,
});

/** 永久删除画布 */
export const TrashPermanentlyDeleteCanvas = Rpc.make("trash.permanentlyDeleteCanvas", {
  payload: S.Struct({ id: S.String }),
  success: S.Void,
  error: TrashListError,
});
