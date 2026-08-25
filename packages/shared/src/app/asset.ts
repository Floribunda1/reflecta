/** asset 域 wire format（Effect Schema 单一真源）。 */
import * as S from "effect/Schema";

export const OrphanAssetInfo = S.Struct({ filename: S.String, size: S.Number });
export type OrphanAssetInfo = S.Schema.Type<typeof OrphanAssetInfo>;
