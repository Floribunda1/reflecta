/** about 域契约（迁移批 ①）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
import { AboutVersionInfo } from "@reflecta/shared";

/** 应用版本/更新能力信息（对齐 AboutVersionInfo）。 */
export const AboutGetVersionInfo = rpc("about.getVersionInfo", S.Struct({}), AboutVersionInfo);
export const AboutCheckForUpdates = rpc(
  "about.checkForUpdates",
  S.Struct({}),
  S.Struct({ started: S.Boolean }),
);
