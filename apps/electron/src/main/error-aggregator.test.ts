import { describe, expect, test, vi } from "vitest";
import type { DiagnosticEventInput } from "./diagnostic-log";
import {
  ERROR_AGGREGATE_EVENT,
  ErrorAggregator,
  errorFingerprint,
  type ErrorAggregatorOptions,
} from "./error-aggregator";

function errorEvent(overrides: Partial<DiagnosticEventInput> = {}): DiagnosticEventInput {
  return {
    level: "error",
    event: "ipc.request.failed",
    scope: "ipc",
    attrs: {
      "ipc.channel": "chat.sendAgentCommand",
      "error.name": "Error",
      "error.message": "boom",
      "error.stack": "Error: boom\n  at handler (app.js:12:3)",
    },
    ...overrides,
  };
}

function createAggregator(overrides: Partial<ErrorAggregatorOptions> = {}) {
  const write = vi.fn();
  const aggregator = new ErrorAggregator({
    write,
    now: () => new Date("2026-08-15T10:00:00"),
    ...overrides,
  });
  return { aggregator, write };
}

describe("errorFingerprint", () => {
  test("groups repeats regardless of stack detail", () => {
    const first = errorEvent();
    const rebuilt = errorEvent({
      attrs: { ...first.attrs, "error.stack": "Error: boom\n  at handler (app.js:99:9)" },
    });
    expect(errorFingerprint(first)).toBe(errorFingerprint(rebuilt));
  });

  test("separates different channels, sources and messages", () => {
    const base = errorEvent();
    const otherChannel = errorEvent({ attrs: { ...base.attrs, "ipc.channel": "other.channel" } });
    const otherSource = errorEvent({ attrs: { ...base.attrs, source: "window.error" } });
    const otherMessage = errorEvent({ attrs: { ...base.attrs, "error.message": "different" } });
    const fingerprints = [
      errorFingerprint(base),
      errorFingerprint(otherChannel),
      errorFingerprint(otherSource),
      errorFingerprint(otherMessage),
    ];
    expect(new Set(fingerprints).size).toBe(4);
  });
});

describe("ErrorAggregator", () => {
  test("counts repeated errors without emitting below threshold", () => {
    const { aggregator, write } = createAggregator({ minCount: 3 });
    aggregator.observe(errorEvent());
    aggregator.observe(errorEvent());
    aggregator.flush();
    expect(write).not.toHaveBeenCalled();
  });

  test("emits a single aggregate once the threshold is crossed", () => {
    const { aggregator, write } = createAggregator({ minCount: 3 });
    for (let i = 0; i < 3; i += 1) aggregator.observe(errorEvent());
    aggregator.flush();

    expect(write).toHaveBeenCalledTimes(1);
    const event = write.mock.calls[0][0] as DiagnosticEventInput;
    expect(event.event).toBe(ERROR_AGGREGATE_EVENT);
    expect(event.level).toBe("error");
    expect(event.scope).toBe("app");
    expect(event.attrs).toMatchObject({
      "error.count": 3,
      "error.event": "ipc.request.failed",
      "error.scope": "ipc",
      "error.fingerprint": errorFingerprint(errorEvent()),
      "error.name": "Error",
      "error.message": "boom",
      "error.stack": expect.stringContaining("boom"),
    });
  });

  test("does not re-emit on later flushes while the bucket stays open", () => {
    const { aggregator, write } = createAggregator({ minCount: 3 });
    for (let i = 0; i < 3; i += 1) aggregator.observe(errorEvent());
    aggregator.flush();
    aggregator.observe(errorEvent());
    aggregator.flush();
    expect(write).toHaveBeenCalledTimes(1);
  });

  test("finalizes yesterday's buckets and drops sub-threshold buckets", () => {
    let current = new Date("2026-08-15T10:00:00");
    const { aggregator, write } = createAggregator({ minCount: 3, now: () => current });

    for (let i = 0; i < 3; i += 1) aggregator.observe(errorEvent());
    aggregator.observe(errorEvent({ attrs: { ...errorEvent().attrs, "error.message": "rare" } }));

    current = new Date("2026-08-16T00:00:01");
    aggregator.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toMatchObject({ attrs: { "error.count": 3 } });

    // Finalized buckets are gone: a new day starts counting from zero.
    aggregator.flush();
    expect(write).toHaveBeenCalledTimes(1);
  });

  test("keeps distinct buckets for distinct channels", () => {
    const { aggregator, write } = createAggregator({ minCount: 3 });
    for (let i = 0; i < 3; i += 1) {
      aggregator.observe(
        errorEvent({ attrs: { ...errorEvent().attrs, "ipc.channel": "a.channel" } }),
      );
      aggregator.observe(
        errorEvent({ attrs: { ...errorEvent().attrs, "ipc.channel": "b.channel" } }),
      );
    }
    aggregator.flush();
    expect(write).toHaveBeenCalledTimes(2);
  });

  test("ignores non-error and aggregate events", () => {
    const { aggregator, write } = createAggregator({ minCount: 1 });
    aggregator.observe({ level: "info", event: "app.ready", scope: "app" });
    aggregator.observe({ level: "error", event: ERROR_AGGREGATE_EVENT, scope: "app" });
    aggregator.flush();
    expect(write).not.toHaveBeenCalled();
  });

  test("start and stop manage the flush timer", () => {
    vi.useFakeTimers();
    try {
      const { aggregator, write } = createAggregator({ minCount: 1, flushIntervalMs: 1000 });
      aggregator.start();
      aggregator.observe(errorEvent());
      vi.advanceTimersByTime(2000);
      expect(write).toHaveBeenCalledTimes(1);

      aggregator.stop();
      vi.advanceTimersByTime(2000);
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
