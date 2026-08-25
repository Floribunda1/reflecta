/** about 域 wire format（Effect Schema 单一真源）。 */
import * as S from "effect/Schema";

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
