import type { ElectronAPI } from "@electron-toolkit/preload";
import type { services } from "@main/services";
import type { ipcRenderer } from "electron";
import type { IpcBridge } from "electron-effect-rpc";
import type { AgentSessionFeedApi } from "./agent-session-feed";

declare global {
  interface Window {
    electron: ElectronAPI;
    agentSessionFeed: AgentSessionFeedApi;
    fileSystem: {
      getPathForFile: (file: File) => string;
    };
    ipcRenderer: typeof ipcRenderer;
    /** Effect IPC（electron-effect-rpc）暴露的 bridge（app 级，含各域） */
    api: IpcBridge;
  }
}
