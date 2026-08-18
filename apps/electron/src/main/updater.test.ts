import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const electronState = vi.hoisted(() => ({
  isPackaged: true,
  focused: true,
  focusListeners: [] as Array<() => void>,
  userDataDir: "/tmp/fake-user-data",
}));
const fsState = vi.hoisted(() => new Map<string, string>());
const spawnMock = vi.hoisted(() => vi.fn());
const sentMessages = vi.hoisted(() => [] as Array<{ channel: string; payload: unknown }>);
const windows = vi.hoisted(() => [] as Array<{ webContents: { send: () => void } }>);
let lastChild: ReturnType<typeof mockChildProcess> | null = null;

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronState.isPackaged;
    },
    getPath: (name: string) => {
      if (name === "userData") return electronState.userDataDir;
      throw new Error(`Unexpected app path: ${name}`);
    },
    on: (_event: string, listener: () => void) => {
      electronState.focusListeners.push(listener);
    },
  },
  BrowserWindow: {
    getFocusedWindow: () => (electronState.focused ? {} : null),
    getAllWindows: () => windows,
  },
  dialog: {
    showMessageBox: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("node:fs", () => ({
  existsSync: () => true,
  readFileSync: (filePath: string) => {
    const value = fsState.get(filePath);
    if (value === undefined) throw new Error(`ENOENT: ${filePath}`);
    return value;
  },
  writeFileSync: (filePath: string, data: string) => {
    fsState.set(filePath, data);
  },
}));

vi.mock("./logger", () => ({
  appLog: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function mockChildProcess() {
  const handlers: Record<string, (code: number | null, signal: NodeJS.Signals | null) => void> = {};
  return {
    once: vi.fn(
      (event: string, handler: (code: number | null, signal: NodeJS.Signals | null) => void) => {
        handlers[event] = handler;
      },
    ),
    emit: (event: string, code = 0) => handlers[event]?.(code, null),
    kill: vi.fn(),
    exitCode: null,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  // process.resourcesPath only exists inside packaged Electron; the updater
  // derives the Sparkle binary from it, so stub it for spawn-path coverage.
  (process as unknown as { resourcesPath?: string }).resourcesPath = "/tmp/fake-resources";
  electronState.isPackaged = true;
  electronState.focused = true;
  electronState.focusListeners = [];
  electronState.userDataDir = "/tmp/fake-user-data";
  fsState.clear();
  sentMessages.length = 0;
  windows.length = 0;
  lastChild = null;
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => {
    lastChild = mockChildProcess();
    return lastChild;
  });
});

afterEach(() => {
  (process as unknown as { resourcesPath?: string }).resourcesPath = undefined;
  vi.useRealTimers();
});

describe("Sparkle update interaction", () => {
  test("keeps manual checks foreground and automatic checks in the background", async () => {
    const { createUpdaterArguments } = await import("./updater");

    expect(createUpdaterArguments("/Applications/Reflecta.app", true)).toEqual([
      "/Applications/Reflecta.app",
      "--foreground",
    ]);
    expect(createUpdaterArguments("/Applications/Reflecta.app", false)).toEqual([
      "/Applications/Reflecta.app",
      "--background",
    ]);
  });

  test("checkForUpdates reports whether a check was started", async () => {
    const { checkForUpdates } = await import("./updater");

    await expect(checkForUpdates(true)).resolves.toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(1);

    electronState.isPackaged = false;
    await expect(checkForUpdates(true)).resolves.toBe(false);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});

describe("check state tracking", () => {
  test("reports no last check before any check completes", async () => {
    const { getLastCheckAt } = await import("./updater");

    expect(getLastCheckAt()).toBeNull();
  });

  test("records the last check time when the updater exits cleanly", async () => {
    const { checkForUpdates, getLastCheckAt } = await import("./updater");
    await checkForUpdates(true);

    expect(lastChild).not.toBeNull();
    lastChild!.emit("close", 0);

    expect(getLastCheckAt()).not.toBeNull();
    expect(new Date(getLastCheckAt()!)).toBeInstanceOf(Date);
  });

  test("does not record a last check time on a failed exit", async () => {
    const { checkForUpdates, getLastCheckAt } = await import("./updater");
    await checkForUpdates(true);

    lastChild!.emit("close", 1);

    expect(getLastCheckAt()).toBeNull();
  });

  test("persists the last check time across module reloads (same file)", async () => {
    const firstModule = await import("./updater");
    await firstModule.checkForUpdates(true);
    lastChild!.emit("close", 0);
    const checkedAt = firstModule.getLastCheckAt();
    expect(checkedAt).not.toBeNull();

    // A fresh module instance reads the persisted state instead of memory.
    const secondModule = await import("./updater");
    expect(secondModule.getLastCheckAt()).toBe(checkedAt);
  });

  test("reports an in-flight check until the updater exits", async () => {
    const { checkForUpdates, isUpdateCheckInProgress } = await import("./updater");
    await checkForUpdates(true);

    expect(isUpdateCheckInProgress()).toBe(true);

    lastChild!.emit("close", 0);
    expect(isUpdateCheckInProgress()).toBe(false);
  });

  test("broadcasts a finished event with the check time on clean exit", async () => {
    const { checkForUpdates } = await import("./updater");
    const fakeWindow = {
      webContents: { send: vi.fn() },
    } as unknown as { webContents: { send: () => void } };
    windows.push(fakeWindow);

    await checkForUpdates(true);
    lastChild!.emit("close", 0);

    expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(1);
    const [channel, payload] = (fakeWindow.webContents.send as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown[];
    expect(channel).toBe("about:update-check-finished");
    expect(payload).toMatchObject({ failed: false });
    expect(typeof (payload as { checkedAt: unknown }).checkedAt).toBe("string");
  });
});

describe("automatic update checks respect window focus", () => {
  test("runs the background check when the app window is focused", async () => {
    const { startAutomaticUpdateChecks } = await import("./updater");
    startAutomaticUpdateChecks();

    await vi.advanceTimersByTimeAsync(15_000);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0]?.[1]).toEqual([expect.any(String), "--background"]);
  });

  test("defers the automatic check while the window is unfocused and runs it on focus", async () => {
    const { startAutomaticUpdateChecks } = await import("./updater");
    startAutomaticUpdateChecks();
    electronState.focused = false;

    await vi.advanceTimersByTimeAsync(15_000);
    expect(spawnMock).not.toHaveBeenCalled();

    electronState.focused = true;
    for (const listener of electronState.focusListeners) listener();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0]?.[1]).toEqual([expect.any(String), "--background"]);
  });

  test("does not re-run a deferred check when focus returns without one pending", async () => {
    const { startAutomaticUpdateChecks } = await import("./updater");
    startAutomaticUpdateChecks();

    // Focused at check time: runs immediately and leaves nothing pending.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(spawnMock).toHaveBeenCalledTimes(1);

    for (const listener of electronState.focusListeners) listener();
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test("manual checks always run even when the window is unfocused", async () => {
    const { checkForUpdates } = await import("./updater");
    electronState.focused = false;

    await checkForUpdates(true);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0]?.[1]).toEqual([expect.any(String), "--foreground"]);
  });

  test("does not schedule automatic checks when the app is unpackaged", async () => {
    const { startAutomaticUpdateChecks } = await import("./updater");
    electronState.isPackaged = false;
    startAutomaticUpdateChecks();

    await vi.advanceTimersByTimeAsync(15_000);

    expect(spawnMock).not.toHaveBeenCalled();
  });
});
