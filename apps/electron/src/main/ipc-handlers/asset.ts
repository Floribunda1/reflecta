/** asset 域 IPC handlers（业务在 services/asset-ops）。 */
import { AssetError } from "../../ipc";
import {
  saveAsset as saveAssetOp,
  scanOrphanAssets,
  cleanOrphanAssets,
  openAsset,
  openExternalPath,
  revealAsset,
} from "../services/asset-ops";
import { liftPromise, toVoid, type HandlerModule } from "./util";

const error = (message: string) => new AssetError({ reason: message, code: 500 });

export const asset: HandlerModule = {
  domain: "asset",
  error,
  handlers: {
    "asset.saveAsset": ({ buffer, filename }) =>
      liftPromise(error, () => saveAssetOp(new Uint8Array(buffer).buffer, filename)),
    "asset.scanOrphanAssets": () => liftPromise(error, () => scanOrphanAssets()),
    "asset.cleanOrphanAssets": ({ filenames }) =>
      liftPromise(error, () => cleanOrphanAssets([...filenames])),
    "asset.openAsset": ({ filename }) => liftPromise(error, () => openAsset(filename)).pipe(toVoid),
    "asset.openExternalPath": ({ filePath }) =>
      liftPromise(error, () => openExternalPath(filePath)).pipe(toVoid),
    "asset.revealAsset": ({ filename }) =>
      liftPromise(error, () => revealAsset(filename)).pipe(toVoid),
  },
};
