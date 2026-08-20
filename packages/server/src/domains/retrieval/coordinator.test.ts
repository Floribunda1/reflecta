import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import type { ReflectaDb } from "../../db/types";
import { RetrievalIndexCoordinator, type RetrievalIndexOperations } from "./coordinator";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

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
    reconcile: () => Effect.succeed({ modified: false, operationCount: 0 }),
    sync: () => Effect.succeed({ modified: true, operationCount: 1 }),
    rebuild: () => Effect.succeed({ modified: true, operationCount: 1 }),
    isReady: () => Effect.succeed(true),
    optimize: () => Effect.succeed(void 0),
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
      sync: vi.fn((_db, ids) => {
        batches.push(ids);
        if (batches.length === 1)
          return Effect.tryPromise({
            try: () => firstBatch.promise,
            catch: toError,
          });
        return Effect.succeed({ modified: true, operationCount: 1 });
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
      reconcile: vi.fn(() => {
        order.push("reconcile");
        return Effect.tryPromise({ try: () => reconciliation.promise, catch: toError });
      }),
      sync: vi.fn((_db, ids) => {
        order.push(`sync:${ids.join(",")}`);
        return Effect.succeed({ modified: true, operationCount: 1 });
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
    const operations = fakeOperations({
      sync: () => Effect.tryPromise({ try: () => batch.promise, catch: toError }),
    });
    const indexCoordinator = coordinator(operations);

    expect(indexCoordinator.enqueue(["understanding-a"])).toBeUndefined();
    expect(await indexCoordinator.getStatus()).toMatchObject({ state: "indexing" });

    batch.resolve({ modified: true, operationCount: 1 });
    await indexCoordinator.flush();
  });

  test("retries one failed batch once and exposes the second failure", async () => {
    const sync = vi.fn(() =>
      Effect.tryPromise({
        try: async () => {
          throw new Error("embedding unavailable");
        },
        catch: toError,
      }),
    );
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
    const optimize = vi.fn(() => Effect.succeed(void 0));
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
      .fn()
      .mockImplementationOnce(() =>
        Effect.tryPromise({
          try: async () => {
            throw new Error("maintenance unavailable");
          },
          catch: toError,
        }),
      )
      .mockImplementationOnce(() => Effect.succeed(void 0));
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
