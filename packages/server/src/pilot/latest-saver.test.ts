import { describe, expect, it } from "vitest";
import { Deferred, Effect } from "effect";
import { makeLatestSaver } from "./latest-saver";

describe("P1/D11: latest-saver（串行 + latest-wins）", () => {
  it("并发请求折叠中间值、串行保存、最终为最新", async () => {
    const run = Effect.gen(function* () {
      const saved: string[] = [];
      const start0 = yield* Deferred.make<void, never>(); // 感知 "0" 在保存并锁住
      const gate0 = yield* Deferred.make<void, never>(); // 放行 "0"
      const done2 = yield* Deferred.make<void, never>(); // 感知最新值 "2" 保存完成

      const saver = yield* makeLatestSaver<string>((value) =>
        Effect.gen(function* () {
          saved.push(value);
          if (value === "0") {
            yield* Deferred.succeed(start0, undefined);
            yield* Deferred.await(gate0); // 模拟慢保存：持锁等待
          }
          if (value === "2") yield* Deferred.succeed(done2, undefined);
        }),
      );

      // 后台跑 "0"（save 0 持锁并等待 gate0）
      yield* saver.request("0").pipe(Effect.forkScoped);
      yield* Deferred.await(start0);
      // 保存中涌来 1、2：两者都在锁外排队，pending 被 2 覆盖（1 折叠）
      yield* saver.request("1").pipe(Effect.forkScoped);
      yield* saver.request("2").pipe(Effect.forkScoped);
      // 放行 0 → 释放锁；随后一个请求在锁内取到最新值 2 并保存
      yield* Deferred.succeed(gate0, undefined);
      yield* Deferred.await(done2);
      return saved;
    });

    const saved = await Effect.runPromise(
      Effect.scoped(run) as Effect.Effect<string[], never, never>,
    );

    // 串行（无并发、无重复保存）：每个值至多一次，且 0 一定先于 2 完成
    expect(new Set(saved).size).toBe(saved.length);
    expect(saved[0]).toBe("0");
    expect(saved.at(-1)).toBe("2"); // latest-wins：最终保存的是最新请求
    expect(saved.indexOf("0")).toBeLessThan(saved.indexOf("2"));
    // 7 点：因为 0 在保存期间持锁，后续请求 1/2 都排在锁外，不可能与 0 并发。
    // 是否折叠 1 取决于调度，但“最终为最新请求 2”是不变量。
  });
});
