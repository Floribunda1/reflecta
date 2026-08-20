/** about 域契约（迁移批 ①）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

/** 应用版本/更新能力信息（对齐 AboutVersionInfo）。 */
export const AboutVersionInfo = S.Struct({
  name: S.String,
  version: S.String,
  arch: S.String,
  platform: S.String,
  packaged: S.Boolean,
  updateCheckSupported: S.Boolean,
  checking: S.Boolean,
  lastCheckAt: S.NullOr(S.String),
});
export type AboutVersionInfo = S.Schema.Type<typeof AboutVersionInfo>;

export const AboutGetVersionInfo = rpc("about.getVersionInfo", S.Struct({}), AboutVersionInfo);
export const AboutCheckForUpdates = rpc(
  "about.checkForUpdates",
  S.Struct({}),
  S.Struct({ started: S.Boolean }),
);
