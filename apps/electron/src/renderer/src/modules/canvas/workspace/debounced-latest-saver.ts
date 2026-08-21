import { Duration, Effect, Exit, Fiber, Option, Ref } from "effect";

export type SaveStatus = "clean" | "dirty" | "saving" | "error";

/**
 * 防抖 latest-saver（并发原语 → Effect 的 B1 迁移）。
 *
 * 只在 `delay` 的拖尾保存**最新**值；从不中断已在途的保存（过期保存在 revision
 * 计数门控下完成，但其状态迁移不会污染最新态）。
 *
 * 用 Effect 表达并发：pending 防抖是一个短生命周期 fiber，每次新 `schedule`
 * 时被 `Fiber.interrupt` 取消；保存跑在共享 Effect runtime 上。R=never 的并发
 * 原语，无需自定义 Layer，直接走默认 runtime。
 */
export function createDebouncedLatestSaver<T>({
  delay,
  save,
  onStatus = () => {},
}: {
  delay: number;
  save: (value: T) => Promise<unknown>;
  onStatus?: (status: SaveStatus) => void;
}) {
  const latest = Effect.runSync(Ref.make<Option.Option<T>>(Option.none()));
  const revision = Effect.runSync(Ref.make(0));
  const pendingTimer = Effect.runSync(
    Ref.make<Option.Option<Fiber.Fiber<unknown, unknown>>>(Option.none()),
  );
  // 在途 persist 的 promise：flush/quit 时等待它落库，避免最后保存被截断
  const runningPromise = Effect.runSync(Ref.make<Option.Option<Promise<unknown>>>(Option.none()));

  const persist = (value: T, rev: number) =>
    Effect.gen(function* () {
      if ((yield* Ref.get(revision)) === rev) onStatus("saving");
      const promise = save(value);
      yield* Ref.set(runningPromise, Option.some(promise));
      const out = yield* Effect.exit(Effect.promise(() => promise));
      yield* Ref.set(runningPromise, Option.none());
      if (Exit.isSuccess(out)) {
        if ((yield* Ref.get(revision)) === rev) onStatus("clean");
      } else if ((yield* Ref.get(revision)) === rev) {
        onStatus("error");
      }
    });

  const schedule = (value: T) => {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Ref.set(latest, Option.some(value));
        const rev = yield* Ref.updateAndGet(revision, (n) => n + 1);
        onStatus("dirty");

        // 取消上一次 pending 防抖（绝不取消在途保存：timer fiber 在开始保存前
        // 已把自己从 ref 清掉，因此此时不再可中断）。
        const previous = yield* Ref.getAndSet(
          pendingTimer,
          Option.none<Fiber.Fiber<unknown, unknown>>(),
        );
        if (Option.isSome(previous)) yield* Fiber.interrupt(previous.value);

        const timer = Effect.runFork(
          Effect.sleep(Duration.millis(delay)).pipe(
            Effect.tap(() => Ref.set(pendingTimer, Option.none<Fiber.Fiber<unknown, unknown>>())),
            Effect.flatMap(() => persist(value, rev)),
          ),
        );
        yield* Ref.set(pendingTimer, Option.some(timer));
      }),
    );
  };

  const flush = (): Promise<void> => {
    const pending = Effect.runSync(
      Ref.getAndSet(pendingTimer, Option.none<Fiber.Fiber<unknown, unknown>>()),
    );
    if (Option.isSome(pending)) Effect.runSync(Fiber.interrupt(pending.value));
    const value = Effect.runSync(Ref.get(latest));
    const rev = Effect.runSync(Ref.get(revision));
    const inFlight = Effect.runSync(Ref.get(runningPromise));
    const waits: Promise<unknown>[] = [];
    if (Option.isSome(inFlight)) waits.push(inFlight.value);
    if (Option.isSome(value)) waits.push(Effect.runPromise(persist(value.value, rev)));
    return Promise.all(waits).then(() => undefined);
  };

  const retry = (): Promise<void> => {
    const value = Effect.runSync(Ref.get(latest));
    if (Option.isNone(value)) return Promise.resolve();
    const rev = Effect.runSync(Ref.get(revision));
    return Effect.runPromise(persist(value.value, rev));
  };

  return { schedule, retry, flush };
}
