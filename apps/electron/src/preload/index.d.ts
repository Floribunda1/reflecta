import type { ElectronAPI } from "@electron-toolkit/preload";
import type { ipcRenderer } from "electron";
import type { AgentSessionFeedApi } from "./typings/agent-session-feed";

declare global {
  interface Window {
    electron: ElectronAPI;
    agentSessionFeed: AgentSessionFeedApi;
    fileSystem: {
      getPathForFile: (file: File) => string;
    };
    ipcRenderer: typeof ipcRenderer;
  }
}
