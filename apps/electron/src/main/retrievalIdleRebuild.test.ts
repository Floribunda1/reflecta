import { afterEach, describe, expect, test, vi } from "vitest";
import { createRetrievalIdleRebuilder } from "./retrievalIdleRebuild";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("retrieval idle rebuild", () => {
  test("rebuilds dirty retrieval index only while the system is idle", async () => {
    let idleState: "active" | "idle" = "active";
    const getIdleState = vi.fn(() => idleState);
    const isDirty = vi.fn(async () => true);
    const rebuild = vi.fn(async () => undefined);
    const rebuilder = createRetrievalIdleRebuilder({
      intervalMs: 60_000,
      getIdleState,
      isDirty,
      rebuild,
    });

    await rebuilder.trigger();
    expect(rebuild).not.toHaveBeenCalled();

    idleState = "idle";
    await rebuilder.trigger();
    expect(rebuild).toHaveBeenCalledTimes(1);

    rebuilder.stop();
  });

  test("skips rebuild when retrieval index is already clean", async () => {
    const rebuild = vi.fn(async () => undefined);
    const rebuilder = createRetrievalIdleRebuilder({
      intervalMs: 60_000,
      getIdleState: () => "idle",
      isDirty: async () => false,
      rebuild,
    });

    await rebuilder.trigger();

    expect(rebuild).not.toHaveBeenCalled();
    rebuilder.stop();
  });
});
