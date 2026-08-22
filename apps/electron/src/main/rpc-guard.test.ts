import { Effect, Logger, References } from "effect";
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

function captureLogs<A, E>(program: Effect.Effect<A, E, never>) {
  const entries: Array<ReturnType<typeof Logger.formatStructured.log>> = [];
  const logger = Logger.make((options) => entries.push(Logger.formatStructured.log(options)));
  return {
    entries,
    program: program.pipe(
      Effect.provideService(References.MinimumLogLevel, "Debug"),
      Effect.provide(Logger.layer([logger])),
    ),
  };
}

describe("guardIpcHandlers（请求摘要，Spring filter 语义）", () => {
  test("成功调用只记录一条带 requestId 的摘要", async () => {
    const handlers: Record<string, Handler> = {
      "understandingCanvas.getCanvas": () => Effect.succeed({ ok: 1 }),
    };
    const guarded = guardIpcHandlers(handlers, () => toContract);
    const { entries, program } = captureLogs(guarded["understandingCanvas.getCanvas"]({}, {}));

    await Effect.runPromise(program);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "DEBUG",
      message: "ipc.request.completed",
      annotations: {
        "ipc.method": "understandingCanvas.getCanvas",
        ok: true,
      },
    });
    expect(entries[0].annotations.requestId).toEqual(expect.any(String));
    expect(entries[0].annotations.durationMs).toEqual(expect.any(Number));
  });

  test("失败调用只记录一条摘要，错误原样抛给契约", async () => {
    const handlers: Record<string, Handler> = {
      "understandingCanvas.saveCanvas": () => Effect.fail(new Error("boom")),
    };
    const guarded = guardIpcHandlers(handlers, () => toContract);
    const { entries, program } = captureLogs(guarded["understandingCanvas.saveCanvas"]({}, {}));
    let caught: unknown;
    try {
      await Effect.runPromise(program);
    } catch (error) {
      caught = error;
    }

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "ERROR",
      message: "ipc.request.failed",
      annotations: {
        "ipc.method": "understandingCanvas.saveCanvas",
        ok: false,
      },
    });
    expect(String(entries[0].annotations.reason)).toContain("boom");
    expect((caught as { reason?: string }).reason).toContain("boom");
  });

  test("未映射域也记录请求摘要", async () => {
    const handlers: Record<string, Handler> = {
      "about.getVersionInfo": () => Effect.succeed("1.0"),
    };
    const guarded = guardIpcHandlers(handlers, () => undefined);
    const { entries, program } = captureLogs(guarded["about.getVersionInfo"]({}, {}));

    await Effect.runPromise(program);

    expect(entries).toHaveLength(1);
    expect(entries[0].annotations["ipc.method"]).toBe("about.getVersionInfo");
  });

  test("requestId 自动传播到 handler 内部日志", async () => {
    const handlers: Record<string, Handler> = {
      "about.getVersionInfo": () => Effect.logInfo("service.event").pipe(Effect.as("1.0")),
    };
    const guarded = guardIpcHandlers(handlers, () => undefined);
    const { entries, program } = captureLogs(guarded["about.getVersionInfo"]({}, {}));

    await Effect.runPromise(program);

    const serviceEntry = entries.find((entry) => entry.message === "service.event");
    expect(serviceEntry?.annotations).toMatchObject({
      "ipc.method": "about.getVersionInfo",
      requestId: expect.any(String),
    });
  });
});
