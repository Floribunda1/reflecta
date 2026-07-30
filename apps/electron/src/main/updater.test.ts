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
