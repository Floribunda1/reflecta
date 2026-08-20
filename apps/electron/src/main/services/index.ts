import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { diagnosticErrorAttrs } from "../diagnostic-log";
import { writeDiagnosticEvent } from "../logger";
import { piAgentHost } from "./core";
import { registerAgentSessionFeed } from "./agent/agent-session-feed-ipc";
import { getSharedModelRuntime } from "./agent/pi-model-runtime";

const originalHandle = ipcMain.handle.bind(ipcMain);
type IpcHandleListener = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => unknown | Promise<unknown>;

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
      // 重抛原错误：electron-effect-rpc 自带 typed error 传输/信封，
      // 不需要旧 decorator 协议的 __isIpcError 折叠。
      throw error;
    }
  };
  return originalHandle(channel, wrapped);
};

registerAgentSessionFeed(piAgentHost);

// Prewarm the shared ModelRuntime at startup (background, non-blocking) so the
// first agent message never waits on the pi.dev catalog refresh / provider
// availability checks. ModelRuntime.create is intentionally not called on the
// per-message hot path.
void getSharedModelRuntime().catch(() => undefined);
