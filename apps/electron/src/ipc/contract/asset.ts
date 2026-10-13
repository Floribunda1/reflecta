/** asset 域契约（迁移批 Round A）。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
import { OrphanAssetInfo } from "@reflecta/shared";

export class AssetError extends S.TaggedError<AssetError>()("AssetError", {
  reason: S.String,
  code: S.Number,
}) {}

export const AssetSave = Rpc.make("asset.saveAsset", {
  payload: S.Struct({ buffer: S.Uint8Array, filename: S.String }),
  success: S.String,
  error: AssetError,
});
export const AssetScanOrphans = Rpc.make("asset.scanOrphanAssets", {
  payload: S.Struct({}),
  success: S.Array(OrphanAssetInfo),
  error: AssetError,
});
export const AssetCleanOrphans = Rpc.make("asset.cleanOrphanAssets", {
  payload: S.Struct({ filenames: S.Array(S.String) }),
  success: S.Number,
  error: AssetError,
});
export const AssetOpen = Rpc.make("asset.openAsset", {
  payload: S.Struct({ filename: S.String }),
  success: S.Void,
  error: AssetError,
});
export const AssetOpenExternalPath = Rpc.make("asset.openExternalPath", {
  payload: S.Struct({ filePath: S.String }),
  success: S.Void,
  error: AssetError,
});
export const AssetReveal = Rpc.make("asset.revealAsset", {
  payload: S.Struct({ filename: S.String }),
  success: S.Void,
  error: AssetError,
});
