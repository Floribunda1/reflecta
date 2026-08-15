// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";
import { reportRendererError } from "./renderer-error";

describe("reportRendererError", () => {
  test("sends a structured payload over the diagnostic channel", () => {
    const send = vi.fn();
    (window as { ipcRenderer?: unknown }).ipcRenderer = { send };

    reportRendererError("react.uncaught", new Error("boom"), {
      componentStack: "    at ThreadView",
    });

    expect(send).toHaveBeenCalledWith(
      "diagnostic:renderer-error",
      expect.objectContaining({
        source: "react.uncaught",
        message: "boom",
        componentStack: "    at ThreadView",
        stack: expect.any(String),
      }),
    );
  });

  test("never throws when the bridge is unavailable", () => {
    (window as { ipcRenderer?: unknown }).ipcRenderer = undefined;

    expect(() => reportRendererError("react.uncaught", new Error("boom"))).not.toThrow();
  });
});
