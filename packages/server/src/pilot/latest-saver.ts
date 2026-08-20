/**
 * P1/D11 并发模式原型 —— 串行 + latest-wins 的 Effect 版 saver。
 *
 * 对应 renderer 现状 `useUnderstandingDraftSave` 里手写的 createDraftSaveQueue
 * （promise 链 + revision 门控 + 一堆 ref）。本原型用官方 Effect 原语表达同一语义：
 * - `Semaphore(1)` 串行化保存（替代 promise 链）；
 * - `Ref` 持有"最新待保存值"（写入即覆盖）→ latest-wins，无需 revision 计数；
 * - 无 worker、无生命周期管理，比手写队列更少状态。
 *
 * 语义：`request(input)` 返回一个 effect，运行后串行地保存"当时的最新值"。
 * 调用方可选择立即 run / fork（fire-and-forget）。仅供模式验证；正式落地在 P4/D11。
 */
import { Effect, Option, Ref, Semaphore } from "effect";

export const makeLatestSaver = <I>(save: (input: I) => Effect.Effect<void>) =>
  Effect.gen(function* () {
    /** 最新待保存值：写入即覆盖，天然 latest-wins / 中间值折叠 */
    const pending = yield* Ref.make<Option.Option<I>>(Option.none());
    /** 串行话：同一时刻最多一个 save 在跑 */
    const lock = yield* Semaphore.make(1);

    return {
      /**
       * 请求保存：无条件写入最新值；随后在锁内取出"当前最新"保存。
       * 若保存间隙又有新请求，后进的会在锁外排队，最终各自取当时最新——整体串行 + 折叠。
       */
      request(input: I): Effect.Effect<void> {
        return Effect.gen(function* () {
          yield* Ref.set(pending, Option.some(input));
          yield* Semaphore.withPermit(lock)(
            Effect.gen(function* () {
              const latest = yield* Ref.getAndSet(pending, Option.none());
              if (Option.isSome(latest)) yield* save(latest.value);
            }),
          );
        });
      },
    };
  });
