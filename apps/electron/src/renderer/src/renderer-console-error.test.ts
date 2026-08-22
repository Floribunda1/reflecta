// @vitest-environment happy-dom

import { afterEach, expect, test, vi } from "vitest";

const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
  vi.restoreAllMocks();
  vi.resetModules();
});

test("forwards console.error arguments and a renderer stack without hiding the browser console", async () => {
  const browserConsoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const send = vi.fn();
  window.ipcRenderer = { send } as unknown as typeof window.ipcRenderer;

  await import("./renderer-console-error");
  console.error("Duplicate key `%s`", "item-1");

  expect(browserConsoleError).toHaveBeenCalledWith("Duplicate key `%s`", "item-1");
  expect(send).toHaveBeenCalledWith(
    "diagnostic:renderer-error",
    expect.objectContaining({
      source: "console.error",
      args: ["Duplicate key `%s`", "item-1"],
      stack: expect.stringContaining("renderer-console-error.test.ts"),
    }),
  );
});
