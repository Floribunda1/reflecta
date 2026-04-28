import type { ElectronAPI } from "@electron-toolkit/preload";
import type { services } from "@main/services";
import type { ipcRenderer } from "electron";
import type { MergeIpcService } from "electron-ipc-decorator";

declare global {
  type IpcServices = MergeIpcService<typeof services>;
  interface Window {
    electron: ElectronAPI;
    ipcRenderer: typeof ipcRenderer;
  }
}
