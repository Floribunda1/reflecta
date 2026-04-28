import { createIpcProxy } from "electron-ipc-decorator/client";

export const ipcClient = createIpcProxy<IpcServices>(window.ipcRenderer)!;
