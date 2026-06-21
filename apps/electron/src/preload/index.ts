import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer } from "electron";
import "electron-log/preload";

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);

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
  window.ipcRenderer = ipcRenderer;
}
