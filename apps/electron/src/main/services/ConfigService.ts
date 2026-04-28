import { app, dialog } from "electron";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import type { AiProviderConfig } from "../config";
import { getStorageRoot, readConfig, writeConfig } from "../config";

export class ConfigService extends IpcService {
  static readonly groupName = "config";

  @IpcMethod()
  async openDirectoryPicker(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "选择存储目录",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  }

  @IpcMethod()
  async setStoragePath(newPath: string): Promise<void> {
    writeConfig({ storagePath: newPath || undefined });
  }

  @IpcMethod()
  async restartApp(): Promise<void> {
    app.relaunch();
    app.quit();
  }

  @IpcMethod()
  async getConfig(): Promise<{ storagePath: string; isCustomPath: boolean }> {
    const config = readConfig();
    return {
      storagePath: getStorageRoot(),
      isCustomPath: !!config.storagePath,
    };
  }

  @IpcMethod()
  async getAiConfig(): Promise<AiProviderConfig> {
    return readConfig().aiProvider ?? { apiKey: "", baseUrl: "", model: "" };
  }

  @IpcMethod()
  async setAiConfig(config: AiProviderConfig): Promise<void> {
    writeConfig({ aiProvider: config });
  }
}
