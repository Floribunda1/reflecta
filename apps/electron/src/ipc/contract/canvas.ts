/** canvas（导出）域契约（迁移批 Round A）。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";

export class CanvasExportError extends S.TaggedError<CanvasExportError>()("CanvasExportError", {
  reason: S.String,
  code: S.Number,
}) {}

export const CanvasExportPng = Rpc.make("canvas.exportPng", {
  payload: S.Struct({ dataUrl: S.String, suggestedName: S.String }),
  success: S.NullOr(S.String),
  error: CanvasExportError,
});
