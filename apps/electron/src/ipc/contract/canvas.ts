/** canvas（导出）域契约（迁移批 Round A）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export class CanvasExportError extends S.TaggedError<CanvasExportError>()("CanvasExportError", {
  reason: S.String,
  code: S.Number,
}) {}

export const CanvasExportPng = rpc(
  "canvas.exportPng",
  S.Struct({ dataUrl: S.String, suggestedName: S.String }),
  S.NullOr(S.String),
  CanvasExportError,
);
