import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const electronState = vi.hoisted(() => ({
  isPackaged: true,
  focused: true,
  focusListeners: [] as Array<() => void>,
}));
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronState.isPackaged;
    },
    on: (_event: string, listener: () => void) => {
      electronState.focusListeners.push(listener);
    },
  },
  BrowserWindow: {
    getFocusedWindow: () => (electronState.focused ? {} : null),
  },
  dialog: {},
  Menu: {},
  MenuItem: class {},
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("node:fs", () => ({
  existsSync: () => true,
}));

vi.mock("./logger", () => ({
  appLog: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function mockChildProcess() {
  return { once: vi.fn(), kill: vi.fn(), exitCode: null };
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
  spawnMock.mockReset();
  spawnMock.mockReturnValue(mockChildProcess());
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
