import { describe, expect, test, vi } from "vitest";
import type { ReflectaDb } from "../../db/types";
import { RetrievalIndexCoordinator, type RetrievalIndexOperations } from "./coordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fakeOperations(
  overrides: Partial<RetrievalIndexOperations> = {},
): RetrievalIndexOperations {
  return {
    reconcile: async () => ({ modified: false, operationCount: 0 }),
    sync: async () => ({ modified: true, operationCount: 1 }),
    rebuild: async () => ({ modified: true, operationCount: 1 }),
    isReady: async () => true,
    optimize: async () => undefined,
    ...overrides,
  };
}

function coordinator(operations: RetrievalIndexOperations, optimizeAfterOperations = 20) {
  return new RetrievalIndexCoordinator({
    getDb: () => ({}) as ReflectaDb,
    operations,
    optimizeAfterOperations,
  });
}

describe("RetrievalIndexCoordinator", () => {
  test("starts an incremental batch immediately and deduplicates the next batch", async () => {
    const firstBatch = deferred<{ modified: boolean; operationCount: number }>();
    const batches: string[][] = [];
    const operations = fakeOperations({
      sync: vi.fn(async (_db, ids) => {
        batches.push(ids);
        if (batches.length === 1) return firstBatch.promise;
        return { modified: true, operationCount: 1 };
      }),
    });
    const indexCoordinator = coordinator(operations);

    indexCoordinator.enqueue(["understanding-a"]);
    expect(batches).toEqual([["understanding-a"]]);

    indexCoordinator.enqueue(["understanding-b", "understanding-b"]);
    firstBatch.resolve({ modified: true, operationCount: 1 });
    await indexCoordinator.flush();

    expect(batches).toEqual([["understanding-a"], ["understanding-b"]]);
  });

  test("processes writes queued during startup reconciliation in the next batch", async () => {
    const reconciliation = deferred<{ modified: boolean; operationCount: number }>();
    const order: string[] = [];
    const operations = fakeOperations({
      reconcile: vi.fn(async () => {
        order.push("reconcile");
        return reconciliation.promise;
      }),
      sync: vi.fn(async (_db, ids) => {
        order.push(`sync:${ids.join(",")}`);
        return { modified: true, operationCount: 1 };
      }),
    });
    const indexCoordinator = coordinator(operations);

    indexCoordinator.start();
    indexCoordinator.enqueue(["understanding-after-start"]);
    reconciliation.resolve({ modified: false, operationCount: 0 });
    await indexCoordinator.flush();

    expect(order).toEqual(["reconcile", "sync:understanding-after-start"]);
  });

  test("returns from enqueue without waiting for indexing", async () => {
    const batch = deferred<{ modified: boolean; operationCount: number }>();
    const operations = fakeOperations({ sync: async () => batch.promise });
    const indexCoordinator = coordinator(operations);

    expect(indexCoordinator.enqueue(["understanding-a"])).toBeUndefined();
    expect(await indexCoordinator.getStatus()).toMatchObject({ state: "indexing" });

    batch.resolve({ modified: true, operationCount: 1 });
    await indexCoordinator.flush();
  });

  test("retries one failed batch once and exposes the second failure", async () => {
    const sync = vi.fn(async () => {
      throw new Error("embedding unavailable");
    });
    const indexCoordinator = coordinator(fakeOperations({ sync }));

    indexCoordinator.enqueue(["understanding-a"]);

    await expect(indexCoordinator.flush()).rejects.toThrow("embedding unavailable");
    expect(sync).toHaveBeenCalledTimes(2);
    expect(await indexCoordinator.getStatus()).toMatchObject({
      state: "error",
      error: "embedding unavailable",
    });
  });

  test("optimizes after the configured number of successful modifications", async () => {
    const optimize = vi.fn(async () => undefined);
    const indexCoordinator = coordinator(fakeOperations({ optimize }), 2);

    indexCoordinator.enqueue(["understanding-a"]);
    await indexCoordinator.flush();
    indexCoordinator.enqueue(["understanding-b"]);
    await indexCoordinator.flush();

    expect(optimize).toHaveBeenCalledTimes(1);
  });

  test("keeps committed data ready when optimization fails and retries after the next update", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const optimize = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("maintenance unavailable"))
      .mockResolvedValueOnce(undefined);
    const indexCoordinator = coordinator(fakeOperations({ optimize }), 1);

    indexCoordinator.enqueue(["understanding-a"]);
    await expect(indexCoordinator.flush()).resolves.toBeUndefined();
    expect(await indexCoordinator.getStatus()).toMatchObject({ state: "ready" });

    indexCoordinator.enqueue(["understanding-b"]);
    await expect(indexCoordinator.flush()).resolves.toBeUndefined();

    expect(optimize).toHaveBeenCalledTimes(2);
    expect(await indexCoordinator.getStatus()).toMatchObject({ state: "ready" });
    warning.mockRestore();
  });
});
