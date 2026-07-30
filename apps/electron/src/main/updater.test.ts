import { describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
  app: {},
  BrowserWindow: {},
  dialog: {},
  Menu: {},
  MenuItem: class {},
}));

vi.mock("./logger", () => ({
  appLog: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Sparkle update probe", () => {
  test("distinguishes an available update from an up-to-date app", async () => {
    const { classifySparkleProbeExitCode } = await import("./updater");

    expect(classifySparkleProbeExitCode(0)).toBe("available");
    expect(classifySparkleProbeExitCode(4)).toBe("current");
    expect(() => classifySparkleProbeExitCode(1)).toThrow("退出码 1");
  });
});
