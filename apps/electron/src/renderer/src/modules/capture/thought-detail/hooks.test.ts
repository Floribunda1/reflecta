// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import { createSequentialLatestRunner } from "./hooks";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createSequentialLatestRunner", () => {
  test("runs tasks sequentially and applies only the latest result", async () => {
    const run = createSequentialLatestRunner();
    const applied: string[] = [];
    const events: string[] = [];
    let resolveFirst: ((value: string) => void) | undefined;
    let resolveSecond: ((value: string) => void) | undefined;

    const first = run(
      () =>
        new Promise<string>((resolve) => {
          events.push("first:start");
          resolveFirst = resolve;
        }),
      (result) => applied.push(result),
    );
    const second = run(
      () =>
        new Promise<string>((resolve) => {
          events.push("second:start");
          resolveSecond = resolve;
        }),
      (result) => applied.push(result),
    );

    await flushMicrotasks();

    expect(events).toEqual(["first:start"]);
    resolveFirst?.("old");
    await first;
    expect(applied).toEqual([]);
    await flushMicrotasks();
    expect(events).toEqual(["first:start", "second:start"]);

    resolveSecond?.("new");
    await second;

    expect(applied).toEqual(["new"]);
  });
});
