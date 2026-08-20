import type { ElectronAPI } from "@electron-toolkit/preload";
import type { services } from "@main/services";
import type { ipcRenderer } from "electron";
import type { MergeIpcService } from "electron-ipc-decorator";
import type { IpcBridgeGlobal } from "electron-effect-rpc";
import type { pilotIpc } from "../ipc/pilot/contract";
import type { AgentSessionFeedApi } from "./agent-session-feed";

declare global {
  type IpcServices = MergeIpcService<typeof services>;
  interface Window {
    electron: ElectronAPI;
    agentSessionFeed: AgentSessionFeedApi;
    fileSystem: {
      getPathForFile: (file: File) => string;
    };
    ipcRenderer: typeof ipcRenderer;
    /** P1 pilot：electron-effect-rpc 暴露的 typed IPC 客户端 */
    api: IpcBridgeGlobal<typeof pilotIpc>;
  }
}
