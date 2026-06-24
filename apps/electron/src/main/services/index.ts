import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { createServices } from "electron-ipc-decorator";
import { diagnosticErrorAttrs } from "../diagnostic-log";
import { writeDiagnosticEvent } from "../logger";
import { AssetService } from "./AssetService";
import { DomainService } from "./DomainService";
import { ChatService } from "./ChatService";
import { ConfigService } from "./ConfigService";
import { ContextService } from "./ContextService";
import { DiagnosticsService } from "./DiagnosticsService";
import { SearchService } from "./SearchService";
import { UnderstandingService } from "./UnderstandingService";
import { TrashService } from "./TrashService";

const originalHandle = ipcMain.handle.bind(ipcMain);
type IpcHandleListener = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => unknown | Promise<unknown>;

function getErrorField(error: unknown, field: "code" | "message"): unknown {
  return typeof error === "object" && error !== null
    ? error[field as keyof typeof error]
    : undefined;
}

function argTypes(args: unknown[]): string[] {
  return args.map((arg) => (Array.isArray(arg) ? "array" : typeof arg));
}

ipcMain.handle = (channel: string, listener: IpcHandleListener) => {
  const wrapped: IpcHandleListener = async (event, ...args) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    try {
      const result = await listener(event, ...args);
      writeDiagnosticEvent({
        level: "debug",
        event: "ipc.request.completed",
        scope: "ipc",
        context: { requestId },
        attrs: {
          "ipc.channel": channel,
          "ipc.argTypes": argTypes(args),
          durationMs: Math.round(performance.now() - startedAt),
        },
      });
      return result;
    } catch (error: unknown) {
      const code = getErrorField(error, "code");
      const message = getErrorField(error, "message");
      writeDiagnosticEvent({
        level: "error",
        event: "ipc.request.failed",
        scope: "ipc",
        context: { requestId },
        attrs: {
          "ipc.channel": channel,
          "ipc.argTypes": argTypes(args),
          durationMs: Math.round(performance.now() - startedAt),
          ...diagnosticErrorAttrs(error),
        },
      });
      throw {
        __isIpcError: true,
        code: typeof code === "string" ? code : "UNKNOWN",
        message: typeof message === "string" ? message : "未知错误",
      };
    }
  };
  return originalHandle(channel, wrapped);
};

export const services = createServices([
  AssetService,
  DomainService,
  ChatService,
  ConfigService,
  DiagnosticsService,
  UnderstandingService,
  ContextService,
  SearchService,
  TrashService,
]);
