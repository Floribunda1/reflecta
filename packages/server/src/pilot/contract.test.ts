import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { TrashContract, TrashListError, trashHandlers } from "./contract";

/**
 * 经官方 RpcTest 内存传输，客户端直连同一契约的 handler（不经序列化，验证机制本身）。
 * handler 通过契约实例方法 `TrashContract.toLayer(...)` 注入环境。
 */
describe("P1 pilot: trash rpc contract typed-error roundtrip", () => {
  const HandlerLayer = TrashContract.toLayer(trashHandlers);

  function runClient<A, E>(effect: Effect.Effect<A, E, unknown>) {
    return Effect.scoped(effect)
      .pipe(Effect.provide(HandlerLayer))
      .pipe((eff) => Effect.runPromise(eff as Effect.Effect<A, E, never>));
  }

  it("成功路径：client 调 trash.list 返回类型化条目", async () => {
    const items = await runClient(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(TrashContract);
        return yield* client["trash.list"](undefined);
      }),
    );
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("a");
    expect(items[1].title).toBe("refactor note");
  });

  it("失败路径：typed error 经 rpc 往返，catchTag 按 tag 精确捕获且字段完整", async () => {
    const recovered = await runClient(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(TrashContract);
        return yield* client["trash.get"]({ id: "boom" }).pipe(
          Effect.catchTag("TrashListError", (error: TrashListError) => Effect.succeed(error)),
        );
      }),
    );
    expect(recovered).toBeInstanceOf(TrashListError);
    if (!(recovered instanceof TrashListError)) return;
    expect(recovered.code).toBe(404);
    expect(recovered.message).toBe("not found: boom");
  });
});
