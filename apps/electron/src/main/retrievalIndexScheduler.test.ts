import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRetrievalIndexScheduler } from "./retrievalIndexScheduler";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("retrieval index scheduler", () => {
  test("merges nearby knowledge updates into one rebuild", async () => {
    const rebuild = vi.fn(async () => undefined);
    const scheduler = createRetrievalIndexScheduler({
      debounceMs: 2_000,
      maxWaitMs: 10_000,
      recoveryIntervalMs: 60_000,
      isDirty: async () => true,
      rebuild,
    });

    scheduler.notify();
    await vi.advanceTimersByTimeAsync(1_500);
    scheduler.notify();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(rebuild).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(rebuild).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  test("does not postpone continuous updates beyond the maximum wait", async () => {
    const rebuild = vi.fn(async () => undefined);
    const scheduler = createRetrievalIndexScheduler({
      debounceMs: 2_000,
      maxWaitMs: 10_000,
      recoveryIntervalMs: 60_000,
      isDirty: async () => true,
      rebuild,
    });

    scheduler.notify();
    for (let elapsed = 1_000; elapsed < 10_000; elapsed += 1_000) {
      await vi.advanceTimersByTimeAsync(1_000);
      scheduler.notify();
    }
    expect(rebuild).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(rebuild).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  test("recovery polling retries dirty work after a failed rebuild", async () => {
    const rebuild = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue(undefined);
    const scheduler = createRetrievalIndexScheduler({
      debounceMs: 2_000,
      recoveryIntervalMs: 30_000,
      isDirty: async () => true,
      rebuild,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(rebuild).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(rebuild).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_001);
    expect(rebuild).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });
});
