/** diagnostics 域 IPC handlers（无契约错误，不纳入 rpcGuard）。 */
import { Effect } from "effect";
import { shell } from "electron";
import { getLogFilePath } from "../logger";
import type { HandlerModule } from "./util";

export const diagnostics: HandlerModule = {
  domain: "diagnostics",
  handlers: {
    "diagnostics.getLogFilePath": () => Effect.sync(() => getLogFilePath()),
    "diagnostics.showLogFile": () =>
      Effect.sync(() => {
        const logFilePath = getLogFilePath();
        shell.showItemInFolder(logFilePath);
        return logFilePath;
      }),
  },
};
