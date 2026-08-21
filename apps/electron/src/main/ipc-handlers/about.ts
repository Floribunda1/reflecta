/** about 域 IPC handlers（业务在 updater/logger；无契约错误，不纳入 rpcGuard）。 */
import { Effect } from "effect";
import { app } from "electron";
import { APP_NAME } from "../logger";
import {
  checkForUpdates,
  getLastCheckAt,
  isUpdateCheckInProgress,
  isUpdateCheckSupported,
} from "../updater";
import type { HandlerModule } from "./util";

export const about: HandlerModule = {
  domain: "about",
  handlers: {
    "about.getVersionInfo": () =>
      Effect.sync(() => ({
        name: APP_NAME,
        version: app.getVersion(),
        arch: process.arch,
        platform: process.platform,
        packaged: app.isPackaged,
        updateCheckSupported: isUpdateCheckSupported(),
        checking: isUpdateCheckSupported() && isUpdateCheckInProgress(),
        lastCheckAt: getLastCheckAt(),
      })),
    "about.checkForUpdates": () =>
      Effect.promise(async () => {
        const started = await checkForUpdates(true);
        return { started };
      }),
  },
};
