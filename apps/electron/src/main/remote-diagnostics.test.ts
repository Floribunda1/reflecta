import { describe, expect, test, vi } from "vitest";
import type { DiagnosticEventInput } from "./diagnostic-log";
import { forwardDiagnosticEvents } from "./remote-diagnostics";

const { listeners, mockOnDiagnosticEvent } = vi.hoisted(() => {
  const listeners: Array<(event: DiagnosticEventInput) => void> = [];
  return {
    listeners,
    mockOnDiagnosticEvent: vi.fn((listener: (event: DiagnosticEventInput) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }),
  };
});

vi.mock("./logger", () => ({ onDiagnosticEvent: mockOnDiagnosticEvent }));

type FetchMock = (input: string, init: RequestInit) => Promise<unknown>;

function okFetch(): ReturnType<typeof vi.fn<FetchMock>> {
  const fn = vi.fn<FetchMock>();
  fn.mockResolvedValue({ ok: true });
  return fn;
}

function failingFetch(): ReturnType<typeof vi.fn<FetchMock>> {
  const fn = vi.fn<FetchMock>();
  fn.mockRejectedValue(new Error("network down"));
  return fn;
}

function emit(event: DiagnosticEventInput): void {
  for (const listener of listeners) listener(event);
}

describe("forwardDiagnosticEvents", () => {
  test("registers an observer on the diagnostic outlet", () => {
    forwardDiagnosticEvents("https://example.com/telemetry");
    expect(mockOnDiagnosticEvent).toHaveBeenCalledTimes(1);
  });

  test("forwards warn and error events as redacted JSON POSTs", async () => {
    const fetchFn = okFetch();
    forwardDiagnosticEvents("https://example.com/telemetry", { fetchFn });

    emit({
      level: "error",
      event: "ipc.request.failed",
      scope: "ipc",
      attrs: {
        "ipc.channel": "chat.sendAgentCommand",
        "error.message": "boom",
        api_key: "sk-secret-value",
      },
    });
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/telemetry");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");

    const body = JSON.parse(String(init.body)) as DiagnosticEventInput;
    expect(body.event).toBe("ipc.request.failed");
    expect(body.attrs).toMatchObject({
      "ipc.channel": "chat.sendAgentCommand",
      api_key: "[redacted]",
    });
  });

  test("filters out debug and info events below the configured level", () => {
    const fetchFn = okFetch();
    forwardDiagnosticEvents("https://example.com/telemetry", { level: "warn", fetchFn });

    emit({ level: "debug", event: "ipc.request.completed", scope: "ipc" });
    emit({ level: "info", event: "app.ready", scope: "app" });
    emit({ level: "warn", event: "slow.operation", scope: "app" });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as DiagnosticEventInput;
    expect(body.event).toBe("slow.operation");
  });

  test("never throws when the endpoint is unreachable", async () => {
    const fetchFn = failingFetch();
    forwardDiagnosticEvents("https://example.com/telemetry", { fetchFn });

    emit({ level: "error", event: "app.fallback.error", scope: "app" });
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
  });

  test("unsubscribe stops forwarding", () => {
    const fetchFn = okFetch();
    const unsubscribe = forwardDiagnosticEvents("https://example.com/telemetry", { fetchFn });

    unsubscribe();
    emit({ level: "error", event: "app.fallback.error", scope: "app" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
