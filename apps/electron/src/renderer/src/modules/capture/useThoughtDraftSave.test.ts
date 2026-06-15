// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";
import { createDraftSaveQueue, type DraftSaveSnapshot } from "./useThoughtDraftSave";

function snapshot(partial: Partial<DraftSaveSnapshot> = {}): DraftSaveSnapshot {
  return {
    thoughtId: partial.thoughtId ?? "thought-1",
    title: partial.title ?? "Title",
    body: partial.body ?? "Body",
  };
}

describe("createDraftSaveQueue", () => {
  test("runs saves sequentially and applies only the latest success", async () => {
    const events: string[] = [];
    let resolveFirst: ((value: { updatedAt: string }) => void) | undefined;
    let resolveSecond: ((value: { updatedAt: string }) => void) | undefined;
    const onSucceeded = vi.fn();

    const queue = createDraftSaveQueue({
      save: (input) =>
        new Promise<{ updatedAt: string }>((resolve) => {
          events.push(`${input.body}:start`);
          if (input.body === "first") resolveFirst = resolve;
          if (input.body === "second") resolveSecond = resolve;
        }),
      onStarted: (input) => events.push(`${input.body}:queued`),
      onSucceeded,
      onFailed: vi.fn(),
    });

    const first = queue.save(snapshot({ body: "first" }));
    const second = queue.save(snapshot({ body: "second" }));

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["first:queued", "second:queued", "first:start"]);

    resolveFirst?.({ updatedAt: "2026-06-15T00:00:00.000Z" });
    await first;
    await Promise.resolve();
    await Promise.resolve();

    expect(onSucceeded).not.toHaveBeenCalled();
    expect(events).toEqual(["first:queued", "second:queued", "first:start", "second:start"]);

    resolveSecond?.({ updatedAt: "2026-06-15T00:00:01.000Z" });
    await second;

    expect(onSucceeded).toHaveBeenCalledOnce();
    expect(onSucceeded).toHaveBeenCalledWith(snapshot({ body: "second" }), {
      updatedAt: "2026-06-15T00:00:01.000Z",
    });
  });

  test("applies only the latest failure", async () => {
    const onFailed = vi.fn();
    const queue = createDraftSaveQueue({
      save: async (input) => {
        if (input.body === "first") throw new Error("old failure");
        throw new Error("new failure");
      },
      onStarted: vi.fn(),
      onSucceeded: vi.fn(),
      onFailed,
    });

    await expect(queue.save(snapshot({ body: "first" }))).rejects.toThrow("old failure");
    await expect(queue.save(snapshot({ body: "second" }))).rejects.toThrow("new failure");

    expect(onFailed).toHaveBeenCalledTimes(2);
    expect(onFailed).toHaveBeenLastCalledWith(snapshot({ body: "second" }), "new failure");
  });
});
