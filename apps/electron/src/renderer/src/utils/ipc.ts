import { createIpcProxy } from "electron-ipc-decorator/client";

const baseProxy = window.ipcRenderer
  ? createIpcProxy<IpcServices>(window.ipcRenderer)!
  : ({} as IpcServices);

type IpcErrorPayload = {
  __isIpcError?: unknown;
  code?: unknown;
  message?: unknown;
};

function isIpcErrorPayload(error: unknown): error is IpcErrorPayload {
  return typeof error === "object" && error !== null && "__isIpcError" in error;
}

function wrapWithErrorHandling<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, groupName: string) {
      const group = (target as Record<string, unknown>)[groupName];
      if (!group) return group;
      const groupRecord = group as Record<string, unknown>;
      return new Proxy(group, {
        get(_, methodName: string) {
          const method = groupRecord[methodName];
          if (typeof method !== "function") return method;
          return async (...args: unknown[]) => {
            try {
              return await method(...args);
            } catch (error: unknown) {
              if (isIpcErrorPayload(error)) {
                const message = typeof error.message === "string" ? error.message : "未知错误";
                const err = new Error(message) as Error & { code?: string };
                if (typeof error.code === "string") err.code = error.code;
                console.error(`[IPC Error] ${groupName}.${methodName}:`, message);
                throw err;
              }
              throw error;
            }
          };
        },
      });
    },
  });
}

export const ipcClient = wrapWithErrorHandling(baseProxy);
