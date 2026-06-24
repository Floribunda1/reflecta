import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-logger-test-"));
  roots.push(root);
  return root;
}

function useContentRoot(root: string) {
  process.argv = ["electron", "app", "--reflecta-content-root", root];
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
});

afterEach(() => {
  process.argv = originalArgv;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Electron logging profile", () => {
  test("uses Reflecta Dev as the dev log app name", async () => {
    const root = tempRoot();
    useContentRoot(root);
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
    useContentRoot(tempRoot());
    mockElectron.isPackaged = true;
    const { APP_NAME, getLogAppName, initializeLogging } = await import("./logger");

    expect(APP_NAME).toBe("Reflecta");
    expect(getLogAppName()).toBe("Reflecta");

    initializeLogging();

    expect(mockLogger.transports.file.setAppName).toHaveBeenCalledWith("Reflecta");
  });

  test("writes fallback errors as diagnostic log events", async () => {
    const root = tempRoot();
    useContentRoot(root);
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
    const root = tempRoot();
    useContentRoot(root);
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
});
