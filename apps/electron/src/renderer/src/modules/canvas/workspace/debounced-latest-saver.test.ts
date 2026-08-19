import { afterEach, describe, expect, test, vi } from "vitest";
import { createDebouncedLatestSaver, type SaveStatus } from "./debounced-latest-saver";

afterEach(() => vi.useRealTimers());

describe("debounced latest saver", () => {
  test("debounces changes and saves only the latest value", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const saver = createDebouncedLatestSaver({ delay: 100, save });
    saver.schedule("first");
    saver.schedule("latest");

    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("latest");
  });

  test("reports dirty, saving, and clean around a successful save", async () => {
    vi.useFakeTimers();
    const statuses: SaveStatus[] = [];
    const saver = createDebouncedLatestSaver({
      delay: 100,
      save: async () => {},
      onStatus: (status) => statuses.push(status),
    });
    saver.schedule("document");
    await vi.advanceTimersByTimeAsync(100);
    expect(statuses).toEqual(["dirty", "saving", "clean"]);
  });

  test("keeps the latest revision dirty when an older request finishes", async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const first = new Promise<void>((resolve) => (finishFirst = resolve));
    const statuses: SaveStatus[] = [];
    const save = vi.fn((value: string) => (value === "first" ? first : Promise.resolve()));
    const saver = createDebouncedLatestSaver({
      delay: 100,
      save,
      onStatus: (status) => statuses.push(status),
    });
    saver.schedule("first");
    await vi.advanceTimersByTimeAsync(100);
    saver.schedule("latest");
    finishFirst();
    await first;
    expect(statuses.at(-1)).toBe("dirty");
    await vi.advanceTimersByTimeAsync(100);
    expect(statuses.at(-1)).toBe("clean");
  });

  test("keeps a failed value retryable and clears the error after retry", async () => {
    vi.useFakeTimers();
    const statuses: SaveStatus[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const saver = createDebouncedLatestSaver({
      delay: 100,
      save,
      onStatus: (status) => statuses.push(status),
    });
    saver.schedule("latest");
    await vi.advanceTimersByTimeAsync(100);
    expect(statuses.at(-1)).toBe("error");
    await saver.retry();
    expect(save).toHaveBeenLastCalledWith("latest");
    expect(statuses.at(-1)).toBe("clean");
  });

  test("flushes a pending value immediately", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const saver = createDebouncedLatestSaver({ delay: 100, save });
    saver.schedule("pending");
    await saver.flush();
    expect(save).toHaveBeenCalledWith("pending");
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("document and viewport savers debounce independently", async () => {
    vi.useFakeTimers();
    const saveDocument = vi.fn(async () => {});
    const saveViewport = vi.fn(async () => {});
    const documentSaver = createDebouncedLatestSaver({ delay: 100, save: saveDocument });
    const viewportSaver = createDebouncedLatestSaver({ delay: 60, save: saveViewport });
    documentSaver.schedule("document");
    viewportSaver.schedule("viewport");
    await vi.advanceTimersByTimeAsync(60);
    expect(saveViewport).toHaveBeenCalledOnce();
    expect(saveDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40);
    expect(saveDocument).toHaveBeenCalledOnce();
  });
});
