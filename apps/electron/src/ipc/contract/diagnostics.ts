/** diagnostics 域契约（迁移批 Round A）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export const DiagnosticsGetLogFilePath = rpc("diagnostics.getLogFilePath", S.Struct({}), S.String);
export const DiagnosticsShowLogFile = rpc("diagnostics.showLogFile", S.Struct({}), S.String);
