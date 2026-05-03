import { createIpcProxy } from "electron-ipc-decorator/client";

const baseProxy = createIpcProxy<IpcServices>(window.ipcRenderer)!;

function wrapWithErrorHandling<T extends Record<string, any>>(obj: T): T {
  return new Proxy(obj, {
    get(target, groupName: string) {
      const group = target[groupName];
      if (!group) return group;
      return new Proxy(group, {
        get(_, methodName: string) {
          const method = group[methodName];
          if (typeof method !== "function") return method;
          return async (...args: any[]) => {
            try {
              return await method(...args);
            } catch (error: any) {
              if (error?.__isIpcError) {
                const err = new Error(error.message);
                (err as any).code = error.code;
                console.error(`[IPC Error] ${groupName}.${methodName}:`, error.message);
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
