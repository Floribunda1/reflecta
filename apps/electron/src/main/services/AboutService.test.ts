import { beforeEach, describe, expect, test, vi } from "vitest";

const electronState = vi.hoisted(() => ({
  version: "1.5.0",
  packaged: false,
}));

vi.mock("electron", () => ({
  app: {
    getVersion: () => electronState.version,
    get isPackaged() {
      return electronState.packaged;
    },
  },
}));

vi.mock("electron-ipc-decorator", () => ({
  IpcMethod: () => () => undefined,
  IpcService: class {},
}));

const updaterState = vi.hoisted(() => ({
  supported: false,
  checking: false,
  lastCheckAt: null as string | null,
  started: true,
}));

vi.mock("../updater", () => ({
  isUpdateCheckSupported: vi.fn(() => updaterState.supported),
  isUpdateCheckInProgress: vi.fn(() => updaterState.checking),
  getLastCheckAt: vi.fn(() => updaterState.lastCheckAt),
  checkForUpdates: vi.fn(async (manual: boolean) => {
    expect(manual).toBe(true);
    return updaterState.started;
  }),
}));

vi.mock("../logger", () => ({
  APP_NAME: "Reflecta",
}));

beforeEach(() => {
  vi.resetModules();
  updaterState.supported = false;
  updaterState.checking = false;
  updaterState.lastCheckAt = null;
  updaterState.started = true;
  electronState.packaged = false;
});

describe("AboutService", () => {
  test("getVersionInfo reports the app version, architecture and update capability", async () => {
    const { AboutService } = await import("./AboutService");
    const service = new AboutService();

    updaterState.supported = true;
    updaterState.lastCheckAt = "2026-01-01T00:00:00.000Z";

    const info = service.getVersionInfo();

    expect(info).toEqual({
      name: "Reflecta",
      version: "1.5.0",
      arch: process.arch,
      platform: process.platform,
      packaged: false,
      updateCheckSupported: true,
      checking: false,
      lastCheckAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("getVersionInfo flags an in-flight check only when updates are supported", async () => {
    const { AboutService } = await import("./AboutService");
    const service = new AboutService();

    updaterState.supported = true;
    updaterState.checking = true;
    expect(service.getVersionInfo().checking).toBe(true);

    updaterState.supported = false;
    expect(service.getVersionInfo().checking).toBe(false);
  });

  test("checkForUpdates delegates to the updater in foreground mode", async () => {
    const { AboutService } = await import("./AboutService");
    const updater = await import("../updater");
    const service = new AboutService();

    await expect(service.checkForUpdates()).resolves.toEqual({ started: true });
    expect(updater.checkForUpdates).toHaveBeenCalledWith(true);
  });
});
