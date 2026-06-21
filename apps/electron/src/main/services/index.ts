import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { createServices } from "electron-ipc-decorator";
import { AssetService } from "./AssetService";
import { CategoryService } from "./CategoryService";
import { ChatService } from "./ChatService";
import { ConfigService } from "./ConfigService";
import { ContextService } from "./ContextService";
import { DiagnosticsService } from "./DiagnosticsService";
import { SearchService } from "./SearchService";
import { ThoughtService } from "./ThoughtService";
import { TrashService } from "./TrashService";

const originalHandle = ipcMain.handle.bind(ipcMain);
type IpcHandleListener = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => unknown | Promise<unknown>;

function getErrorField(error: unknown, field: "code" | "message"): unknown {
  return typeof error === "object" && error !== null
    ? error[field as keyof typeof error]
    : undefined;
}

ipcMain.handle = (channel: string, listener: IpcHandleListener) => {
  const wrapped: IpcHandleListener = async (event, ...args) => {
    try {
      return await listener(event, ...args);
    } catch (error: unknown) {
      const code = getErrorField(error, "code");
      const message = getErrorField(error, "message");
      throw {
        __isIpcError: true,
        code: typeof code === "string" ? code : "UNKNOWN",
        message: typeof message === "string" ? message : "未知错误",
      };
    }
  };
  return originalHandle(channel, wrapped);
};

export const services = createServices([
  AssetService,
  CategoryService,
  ChatService,
  ConfigService,
  DiagnosticsService,
  ThoughtService,
  ContextService,
  SearchService,
  TrashService,
]);
