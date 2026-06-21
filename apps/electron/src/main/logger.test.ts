import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockElectron = vi.hoisted(() => ({
  isPackaged: false,
  appData: "/tmp/app-data",
  userData: "/tmp/user-data",
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
  },
}));

vi.mock("electron-log/main", () => ({ default: mockLogger }));

const originalProfile = process.env.REFLECTA_PROFILE;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalProfile === undefined) delete process.env.REFLECTA_PROFILE;
  else process.env.REFLECTA_PROFILE = originalProfile;
});

describe("Electron logging profile", () => {
  test("uses Reflecta Dev as the dev log app name", async () => {
    process.env.REFLECTA_PROFILE = "dev";
    const { APP_NAME, getLogAppName, initializeLogging } = await import("./logger");

    expect(APP_NAME).toBe("Reflecta");
    expect(getLogAppName()).toBe("Reflecta Dev");

    initializeLogging();

    expect(mockLogger.transports.file.setAppName).toHaveBeenCalledWith("Reflecta Dev");
    expect(mockLogger.transports.file.format).toBe(
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {level}{scope} {text}",
    );
    expect(mockLogger.transports.console.format).toBe(mockLogger.transports.file.format);
  });

  test("uses Reflecta as the prod log app name", async () => {
    process.env.REFLECTA_PROFILE = "prod";
    const { APP_NAME, getLogAppName, initializeLogging } = await import("./logger");

    expect(APP_NAME).toBe("Reflecta");
    expect(getLogAppName()).toBe("Reflecta");

    initializeLogging();

    expect(mockLogger.transports.file.setAppName).toHaveBeenCalledWith("Reflecta");
  });
});
