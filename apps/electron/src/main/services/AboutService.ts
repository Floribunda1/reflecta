import { app } from "electron";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import type { AboutVersionInfo } from "@shared/update";
import { APP_NAME } from "../logger";
import {
  checkForUpdates,
  getLastCheckAt,
  isUpdateCheckInProgress,
  isUpdateCheckSupported,
} from "../updater";

export class AboutService extends IpcService {
  static readonly groupName = "about";

  /** 设置 → 关于：应用名称、版本、架构与更新能力。 */
  @IpcMethod()
  getVersionInfo(): AboutVersionInfo {
    const supported = isUpdateCheckSupported();
    return {
      name: APP_NAME,
      version: app.getVersion(),
      arch: process.arch,
      platform: process.platform,
      packaged: app.isPackaged,
      updateCheckSupported: supported,
      checking: supported && isUpdateCheckInProgress(),
      lastCheckAt: getLastCheckAt(),
    };
  }

  /**
   * 手动检查更新（前台模式，Sparkle 会自行弹出检查结果）。
   * 失败时 updater 已弹出系统错误对话框，此处仅返回是否成功启动。
   */
  @IpcMethod()
  async checkForUpdates(): Promise<{ started: boolean }> {
    const started = await checkForUpdates(true);
    return { started };
  }
}
