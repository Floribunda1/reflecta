/** about 域契约（迁移批 ①）。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
import { AboutVersionInfo } from "@reflecta/shared";

/** 应用版本/更新能力信息（对齐 AboutVersionInfo）。 */
export const AboutGetVersionInfo = Rpc.make("about.getVersionInfo", {
  payload: S.Struct({}),
  success: AboutVersionInfo,
});
export const AboutCheckForUpdates = Rpc.make("about.checkForUpdates", {
  payload: S.Struct({}),
  success: S.Struct({ started: S.Boolean }),
});
