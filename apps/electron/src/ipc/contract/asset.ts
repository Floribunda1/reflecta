/** asset 域契约（迁移批 Round A）。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
import { OrphanAssetInfo } from "@reflecta/shared";

export class AssetError extends S.TaggedError<AssetError>()("AssetError", {
  reason: S.String,
  code: S.Number,
}) {}

export const AssetSave = rpc(
  "asset.saveAsset",
  S.Struct({ buffer: S.Uint8Array, filename: S.String }),
  S.String,
  AssetError,
);
export const AssetScanOrphans = rpc(
  "asset.scanOrphanAssets",
  S.Struct({}),
  S.Array(OrphanAssetInfo),
  AssetError,
);
export const AssetCleanOrphans = rpc(
  "asset.cleanOrphanAssets",
  S.Struct({ filenames: S.Array(S.String) }),
  S.Number,
  AssetError,
);
export const AssetOpen = rpc(
  "asset.openAsset",
  S.Struct({ filename: S.String }),
  S.Void,
  AssetError,
);
export const AssetOpenExternalPath = rpc(
  "asset.openExternalPath",
  S.Struct({ filePath: S.String }),
  S.Void,
  AssetError,
);
export const AssetReveal = rpc(
  "asset.revealAsset",
  S.Struct({ filename: S.String }),
  S.Void,
  AssetError,
);
