import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { guardIpcHandlers, rpcGuard } from "./rpc-guard";

/** 与 main/index.ts 的 cErr 同构的契约错误。 */
const toContract = (reason: string) => ({ reason, code: 500 });

/** 跑经 guard 包装的程序：失败时返回契约错误对象，成功返回 "ok"。 */
async function runGuarded<A>(guarded: Effect.Effect<A, { reason: string; code: number }, never>) {
  try {
    await Effect.runPromise(guarded);
    return "ok";
  } catch (err) {
    return err as { reason?: string };
  }
}

describe("rpcGuard（全局错误兜底，对齐 @ControllerAdvice）", () => {
  test("已知 typed 失败 → 契约化且保留原文", async () => {
    class BizError {
      _tag = "BizError" as const;
      constructor(readonly message: string) {}
    }
    const result = await runGuarded(
      rpcGuard(toContract)(Effect.fail(new BizError("FK constraint failed"))),
    );
    expect(result).toMatchObject({ reason: "FK constraint failed", code: 500 });
  });

  test("业务抛裸 Error（非 typed）→ 兜底为操作失败 + 原文", async () => {
    const program = Effect.tryPromise({
      try: () => Promise.reject(new Error("boom")),
      catch: (e) => e,
    });
    const result = await runGuarded(rpcGuard(toContract)(program));
    expect(result).not.toBe("ok");
    expect(String((result as { reason?: string }).reason)).toContain("boom");
  });

  test("defect（Effect.die）→ 兜底为操作失败 + 原文", async () => {
    const result = await runGuarded(
      rpcGuard(toContract)(Effect.die(new Error("impossible state"))),
    );
    expect(result).not.toBe("ok");
    expect(String((result as { reason?: string }).reason)).toContain("impossible state");
  });

  test("挂起超过阈值 → typed 超时失败", async () => {
    const slow = Effect.sleep("31 seconds").pipe(Effect.as("done"));
    const result = await runGuarded(rpcGuard(toContract, { timeoutMs: 10 })(slow));
    expect(result).not.toBe("ok");
    expect(String((result as { reason?: string }).reason)).toContain("操作超时");
  });

  test("成功路径原样通过", async () => {
    const result = await runGuarded(rpcGuard(toContract)(Effect.succeed({ ok: 1 })));
    expect(result).toBe("ok");
  });
});

type Handler = (input: unknown, context: unknown) => Effect.Effect<unknown, unknown, never>;

describe("guardIpcHandlers（请求摘要，Spring filter 语义）", () => {
  test("成功调用上报 ok + elapsed", async () => {
    const calls: Array<{ name: string; ok: boolean }> = [];
    const handlers: Record<string, Handler> = {
      "understandingCanvas.getCanvas": () => Effect.succeed({ ok: 1 }),
    };
    const guarded = guardIpcHandlers(
      handlers,
      () => toContract,
      (name, _ms, ok) => calls.push({ name, ok }),
    );
    await Effect.runPromise(guarded["understandingCanvas.getCanvas"]({}, {}));
    expect(calls).toEqual([{ name: "understandingCanvas.getCanvas", ok: true }]);
  });

  test("失败调用上报 fail + 原因，错误原样抛给契约", async () => {
    const calls: Array<{ name: string; ok: boolean; reason?: string }> = [];
    const handlers: Record<string, Handler> = {
      "understandingCanvas.saveCanvas": () => Effect.fail(new Error("boom")),
    };
    const guarded = guardIpcHandlers(
      handlers,
      () => toContract,
      (name, _ms, ok, reason) => calls.push({ name, ok, reason }),
    );
    let caught: unknown;
    try {
      await Effect.runPromise(guarded["understandingCanvas.saveCanvas"]({}, {}));
    } catch (error) {
      caught = error;
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("understandingCanvas.saveCanvas");
    expect(calls[0].ok).toBe(false);
    expect(String(calls[0].reason)).toContain("boom");
    expect((caught as { reason?: string }).reason).toContain("boom");
  });

  test("未映射域原样透传且不上报", async () => {
    const calls: Array<{ name: string }> = [];
    const handlers: Record<string, Handler> = {
      "about.getVersionInfo": () => Effect.succeed("1.0"),
    };
    const guarded = guardIpcHandlers(
      handlers,
      () => undefined,
      (name) => calls.push({ name }),
    );
    await Effect.runPromise(guarded["about.getVersionInfo"]({}, {}));
    expect(calls).toHaveLength(0);
  });
});
