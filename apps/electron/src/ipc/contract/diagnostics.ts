/** diagnostics 域契约（迁移批 Round A）。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";

export const DiagnosticsGetLogFilePath = Rpc.make("diagnostics.getLogFilePath", {
  payload: S.Struct({}),
  success: S.String,
});
export const DiagnosticsShowLogFile = Rpc.make("diagnostics.showLogFile", {
  payload: S.Struct({}),
  success: S.String,
});
