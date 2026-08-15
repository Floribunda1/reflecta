import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer, webUtils } from "electron";
import "electron-log/preload";
import { agentSessionFeedApi } from "./agent-session-feed";
import { rendererErrorPayload, sendRendererError } from "./diagnostic-reporter";

window.addEventListener("error", (event) => {
  sendRendererError(
    rendererErrorPayload("window.error", event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }),
  );
});

window.addEventListener("unhandledrejection", (event) => {
  sendRendererError(rendererErrorPayload("window.unhandledrejection", event.reason));
});

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("agentSessionFeed", agentSessionFeedApi);
    contextBridge.exposeInMainWorld("fileSystem", {
      /** 取用户选择/拖拽文件的真实磁盘路径（粘贴等无路径来源返回空串）。 */
      getPathForFile: (file: File) => webUtils.getPathForFile(file),
    });

    const ipcRendererProxy = {
      invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
      send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
      on: (channel: string, listener: (...args: unknown[]) => void) => {
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
      },
      once: (channel: string, listener: (...args: unknown[]) => void) => {
        ipcRenderer.once(channel, listener);
      },
      removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
        ipcRenderer.removeListener(channel, listener);
      },
      removeAllListeners: (channel?: string) => {
        ipcRenderer.removeAllListeners(channel);
      },
      sendSync: (channel: string, ...args: unknown[]) => ipcRenderer.sendSync(channel, ...args),
      postMessage: (channel: string, message: unknown, transfer?: MessagePort[]) => {
        ipcRenderer.postMessage(channel, message, transfer);
      },
    };
    contextBridge.exposeInMainWorld("ipcRenderer", ipcRendererProxy);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.agentSessionFeed = agentSessionFeedApi;
  // @ts-expect-error (define in dts)
  window.ipcRenderer = ipcRenderer;
}
