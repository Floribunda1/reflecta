import { shell } from "electron";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { getLogFilePath } from "../logger";

export class DiagnosticsService extends IpcService {
  static readonly groupName = "diagnostics";

  @IpcMethod()
  getLogFilePath() {
    return getLogFilePath();
  }

  @IpcMethod()
  showLogFile() {
    const logFilePath = getLogFilePath();
    shell.showItemInFolder(logFilePath);
    return logFilePath;
  }
}
