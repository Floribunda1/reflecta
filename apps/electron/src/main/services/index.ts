import { ipcMain } from "electron";
import { createServices } from "electron-ipc-decorator";
import { AiService } from "./AiService";
import { AssetService } from "./AssetService";
import { CategoryService } from "./CategoryService";
import { ConfigService } from "./ConfigService";
import { ContextService } from "./ContextService";
import { SearchService } from "./SearchService";
import { ThoughtService } from "./ThoughtService";
import { TrashService } from "./TrashService";

const originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel: string, listener: any) => {
  const wrapped = async (event: any, ...args: any[]) => {
    try {
      return await listener(event, ...args);
    } catch (error: any) {
      throw {
        __isIpcError: true,
        code: error.code || "UNKNOWN",
        message: error.message || "未知错误",
      };
    }
  };
  return originalHandle(channel, wrapped);
};

export const services = createServices([
  AiService,
  AssetService,
  CategoryService,
  ConfigService,
  ThoughtService,
  ContextService,
  SearchService,
  TrashService,
]);
