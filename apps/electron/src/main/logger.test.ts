import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockElectron = vi.hoisted(() => ({
  isPackaged: false,
  appData: "/tmp/app-data",
  userData: "/tmp/user-data",
  on: vi.fn(),
  ipcMainOn: vi.fn(),
  version: "1.1.0",
}));

const mockLogger = vi.hoisted(() => {
  const scopedLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  return {
    scopedLogger,
    initialize: vi.fn(),
    scope: Object.assign(
      vi.fn(() => scopedLogger),
      { labelPadding: true as boolean | number },
    ),
    transports: {
      file: {
        level: "info" as unknown,
        maxSize: 0,
        format: "",
        setAppName: vi.fn(),
        getFile: vi.fn(() => ({ path: "/tmp/main.log" })),
      },
      console: {
        level: "info" as unknown,
        format: "",
      },
      diagnostic: undefined as unknown,
    },
    errorHandler: { startCatching: vi.fn() },
    eventLogger: { startLogging: vi.fn() },
  };
});

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return mockElectron.isPackaged;
    },
    getPath(name: string) {
      if (name === "appData") return mockElectron.appData;
      if (name === "userData") return mockElectron.userData;
      throw new Error(`Unexpected app path: ${name}`);
    },
    getVersion() {
      return mockElectron.version;
    },
    on: mockElectron.on,
  },
  ipcMain: {
    on: mockElectron.ipcMainOn,
  },
}));

vi.mock("electron-log/main", () => ({ default: mockLogger }));

const originalArgv = process.argv;
const originalNodeEnv = process.env.NODE_ENV;
const originalLogLevel = process.env.REFLECTA_LOG_LEVEL;
const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-logger-test-"));
  roots.push(root);
  return root;
}

function useRuntimeRoots(appConfigRoot: string, contentRoot = tempRoot()) {
  process.argv = [
    "electron",
    "app",
    "--reflecta-app-config-dir",
    appConfigRoot,
    "--reflecta-content-root",
    contentRoot,
  ];
}

function readJsonl(filePath: string): Array<Record<string, unknown>> {
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockLogger.transports.file.level = "info";
  mockLogger.transports.file.format = "";
  mockLogger.transports.console.level = "info";
  mockLogger.transports.console.format = "";
  mockLogger.transports.diagnostic = undefined;
  mockElectron.isPackaged = false;
  process.argv = ["electron", "app"];
  process.env.NODE_ENV = originalNodeEnv;
  if (originalLogLevel === undefined) delete process.env.REFLECTA_LOG_LEVEL;
  else process.env.REFLECTA_LOG_LEVEL = originalLogLevel;
});

afterEach(() => {
  process.argv = originalArgv;
  process.env.NODE_ENV = originalNodeEnv;
  if (originalLogLevel === undefined) delete process.env.REFLECTA_LOG_LEVEL;
  else process.env.REFLECTA_LOG_LEVEL = originalLogLevel;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Electron logging profile", () => {
  test("uses Reflecta Dev as the dev log app name", async () => {
    const appConfigRoot = tempRoot();
    useRuntimeRoots(appConfigRoot);
    const { APP_NAME, getLogAppName, getLogFilePath, initializeLogging } = await import("./logger");

    expect(APP_NAME).toBe("Reflecta");
    expect(getLogAppName()).toBe("Reflecta Dev");

    initializeLogging();

    expect(mockLogger.transports.file.setAppName).toHaveBeenCalledWith("Reflecta Dev");
    expect(mockLogger.transports.file.level).toBe(false);
    expect(typeof mockLogger.transports.diagnostic).toBe("function");
    expect(mockElectron.on).toHaveBeenCalledWith("render-process-gone", expect.any(Function));
    expect(mockElectron.on).toHaveBeenCalledWith("child-process-gone", expect.any(Function));
    expect(mockElectron.ipcMainOn).toHaveBeenCalledWith(
      "diagnostic:renderer-error",
      expect.any(Function),
    );
    expect(getLogFilePath()).toContain(path.join(appConfigRoot, "logs"));
    expect(getLogFilePath()).toMatch(/reflecta-\d{4}-\d{2}-\d{2}\.jsonl$/);
    expect(readJsonl(getLogFilePath())[0]).toMatchObject({
      level: "info",
      event: "app.logging.initialized",
      scope: "app",
      attrs: {
        appName: "Reflecta",
        logAppName: "Reflecta Dev",
        profile: "dev",
        version: "1.1.0",
      },
    });
  });

  test("uses Reflecta as the prod log app name", async () => {
    useRuntimeRoots(tempRoot());
    mockElectron.isPackaged = true;
    const { APP_NAME, getLogAppName, initializeLogging } = await import("./logger");

    expect(APP_NAME).toBe("Reflecta");
    expect(getLogAppName()).toBe("Reflecta");

    initializeLogging();

    expect(mockLogger.transports.file.setAppName).toHaveBeenCalledWith("Reflecta");
  });

  test("routes scoped logs through console and diagnostic transports at the configured level", async () => {
    useRuntimeRoots(tempRoot());
    process.env.NODE_ENV = "development";
    process.env.REFLECTA_LOG_LEVEL = "warn";
    const { appLog, initializeLogging } = await import("./logger");

    initializeLogging();
    appLog.warn("app.test", { ok: true });

    expect(mockLogger.transports.console.level).toBe("warn");
    expect((mockLogger.transports.diagnostic as { level: string }).level).toBe("warn");
    expect(mockLogger.scope).toHaveBeenCalledWith("app");
    expect(mockLogger.scopedLogger.warn).toHaveBeenCalledWith("app.test", { ok: true });
  });

  test("filters direct diagnostic events below the configured level", async () => {
    useRuntimeRoots(tempRoot());
    process.env.REFLECTA_LOG_LEVEL = "info";
    const { getLogFilePath, writeDiagnosticEvent } = await import("./logger");

    writeDiagnosticEvent({ level: "debug", event: "app.hidden", scope: "app" });
    writeDiagnosticEvent({ level: "info", event: "app.visible", scope: "app" });

    expect(readJsonl(getLogFilePath()).map((event) => event.event)).toEqual(["app.visible"]);
  });

  test("forwards Effect log annotations as diagnostic context", async () => {
    const appConfigRoot = tempRoot();
    useRuntimeRoots(appConfigRoot);
    process.env.NODE_ENV = "development";
    const { getEffectLoggingContext, getLogFilePath, initializeLogging } = await import("./logger");
    initializeLogging();

    await Effect.runPromiseWith(getEffectLoggingContext())(
      Effect.logInfo("service.event").pipe(
        Effect.annotateLogs({
          scope: "ipc",
          requestId: "req-1",
          "ipc.method": "about.getVersionInfo",
        }),
      ),
    );

    expect(mockLogger.scope).toHaveBeenCalledWith("ipc");
    const call = mockLogger.scopedLogger.info.mock.calls.at(-1);
    expect(call?.[0]).toBe("service.event");
    expect(call?.[1]).toMatchObject({
      context: { requestId: "req-1" },
      attrs: { "ipc.method": "about.getVersionInfo" },
    });
    const payload = call?.[1];
    const transport = mockLogger.transports.diagnostic as unknown as (message: {
      data: unknown[];
      date: Date;
      level: string;
      scope?: string;
    }) => void;
    transport({
      data: ["service.event", payload],
      date: new Date("2026-08-22T12:00:00.000Z"),
      level: "info",
      scope: "ipc",
    });
    expect(readJsonl(getLogFilePath()).at(-1)).toMatchObject({
      event: "ipc.service.event",
      scope: "ipc",
      context: { requestId: "req-1" },
      attrs: { "ipc.method": "about.getVersionInfo" },
    });
  });

  test("writes fallback errors as diagnostic log events", async () => {
    const appConfigRoot = tempRoot();
    useRuntimeRoots(appConfigRoot);
    const { getLogFilePath, writeFallbackError } = await import("./logger");

    writeFallbackError("unhandledRejection", new Error("boom"), { requestId: "req-1" });

    expect(readJsonl(getLogFilePath())[0]).toMatchObject({
      level: "error",
      event: "app.fallback.error",
      scope: "app",
      attrs: {
        source: "unhandledRejection",
        requestId: "req-1",
        "error.name": "Error",
        "error.message": "boom",
      },
    });
  });

  test("writes renderer errors from the diagnostic IPC channel", async () => {
    const appConfigRoot = tempRoot();
    useRuntimeRoots(appConfigRoot);
    const { DIAGNOSTIC_RENDERER_ERROR_CHANNEL, getLogFilePath, initializeLogging } =
      await import("./logger");

    initializeLogging();
    const handler = mockElectron.ipcMainOn.mock.calls.find(
      ([channel]) => channel === DIAGNOSTIC_RENDERER_ERROR_CHANNEL,
    )?.[1];
    expect(typeof handler).toBe("function");
    handler(
      {},
      {
        source: "window.error",
        message: "renderer boom",
        filename: "app.js",
        lineno: 12,
        colno: 34,
      },
    );

    expect(mockLogger.scopedLogger.error).toHaveBeenCalledWith("renderer.error", {
      source: "window.error",
      message: "renderer boom",
      stack: undefined,
      componentStack: undefined,
      filename: "app.js",
      lineno: 12,
      colno: 34,
      href: undefined,
      userAgent: undefined,
    });
    const [eventName, attrs] = mockLogger.scopedLogger.error.mock.calls.at(-1) ?? [];
    const transport = mockLogger.transports.diagnostic as unknown as (message: {
      data: unknown[];
      date: Date;
      level: string;
      scope?: string;
    }) => void;
    transport({ data: [eventName, attrs], date: new Date(), level: "error", scope: "renderer" });

    const events = readJsonl(getLogFilePath());
    expect(events.find((event) => event.event === "renderer.error")).toMatchObject({
      level: "error",
      event: "renderer.error",
      scope: "renderer",
      attrs: {
        source: "window.error",
        message: "renderer boom",
        filename: "app.js",
        lineno: 12,
        colno: 34,
      },
    });
  });

  test("captures every renderer console error without forwarding other console levels", async () => {
    useRuntimeRoots(tempRoot());
    const { initializeLogging } = await import("./logger");
    initializeLogging();
    const webContents = { on: vi.fn() };
    const onWebContentsCreated = mockElectron.on.mock.calls.find(
      ([event]) => event === "web-contents-created",
    )?.[1];

    onWebContentsCreated({}, webContents);
    const onConsoleMessage = webContents.on.mock.calls.find(
      ([event]) => event === "console-message",
    )?.[1];
    onConsoleMessage({ level: "warning", message: "skip me", sourceId: "app.js", lineNumber: 1 });
    onConsoleMessage({
      level: "error",
      message: "nested button",
      sourceId: "react-dom-client.js",
      lineNumber: 1526,
    });

    expect(mockLogger.scopedLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.scopedLogger.error).toHaveBeenCalledWith("renderer.console.error", {
      message: "nested button",
      sourceId: "react-dom-client.js",
      lineNumber: 1526,
    });
  });
});
