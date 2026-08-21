import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { rpcGuard } from "./rpc-guard";

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
