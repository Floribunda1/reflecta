import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { Cause, Option } from "effect";

/**
 * 全局错误兜底（对齐 Spring 的 @ControllerAdvice / HttpRouter.catchAll）：
 *
 * - 业务代码只要返回任意失败（typed TaggedError、裸 Error、defect、挂起），
 *   到这里统一裁决——业务不需要写任何 mapError / catch / log。
 * - 已知失败（message 或 reason 字段的错误对象）→ `toContract(原文)`。
 * - 未知 / defect → `toContract("操作失败：<cause>")`。
 * - 超过 timeoutMs 未完成 → `toContract("操作超时")`。
 */
export const rpcGuard =
  <ContractError>(
    toContract: (reason: string) => ContractError,
    options: { timeoutMs?: number } = {},
  ) =>
  <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A, ContractError, R> => {
    const resolveReason = (cause: Cause.Cause<unknown>): ContractError => {
      const value = Option.match(Cause.findErrorOption(cause), {
        onNone: () => null,
        onSome: (v) => v,
      });
      if (value && typeof value === "object" && "reason" in value) return value as ContractError;
      const message =
        value && typeof value === "object" && "message" in value
          ? String((value as { message: unknown }).message)
          : "";
      if (message) return toContract(message);
      return toContract(`操作失败：${Cause.squash(cause)}`);
    };
    return program.pipe(
      Effect.timeoutOrElse({
        duration: options.timeoutMs ?? 30_000,
        orElse: () => Effect.fail(toContract("操作超时")),
      }),
      Effect.catchCause((cause) => Effect.fail(resolveReason(cause))),
    );
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HandlerLike = (input: any, context: any) => Effect.Effect<unknown, any, never>;

/** 失败摘要文本（与 rpcGuard 归一同源）：契约错误的 reason → 错误对象 message → squash 原文。 */
export function causeToText(cause: Cause.Cause<unknown>): string {
  const value = Option.match(Cause.findErrorOption(cause), {
    onNone: () => null,
    onSome: (v) => v,
  });
  if (value && typeof value === "object" && "reason" in value) {
    const reason = (value as { reason: unknown }).reason;
    if (reason) return String(reason);
  }
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message: unknown }).message;
    if (message) return String(message);
  }
  return `操作失败：${Cause.squash(cause)}`;
}

/**
 * 对整个 handlers 对象包一次守卫（等价 HttpRouter.catchAll）：
 * 所有请求自动获得 requestId 和一条完成摘要；有域错误构造器的方法额外经 rpcGuard 归一错误。
 */
export const guardIpcHandlers = <T extends Record<string, HandlerLike>>(
  handlers: T,
  resolveCtor: (name: string) => ((reason: string) => unknown) | undefined,
): T => {
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(handlers)) {
    const toContract = resolveCtor(name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out[name] = ((input: any, context: any) => {
      const requestId = randomUUID();
      const started = performance.now();
      const program = Effect.suspend(() => fn(input, context));
      const guarded = toContract
        ? rpcGuard(toContract as (reason: string) => never)(program)
        : program;
      return Effect.catchCause(
        Effect.tap(guarded, () =>
          Effect.logDebug("ipc.request.completed").pipe(
            Effect.annotateLogs({ durationMs: Math.round(performance.now() - started), ok: true }),
          ),
        ),
        (cause) =>
          Effect.logError("ipc.request.failed").pipe(
            Effect.annotateLogs({
              durationMs: Math.round(performance.now() - started),
              ok: false,
              reason: causeToText(cause),
            }),
            Effect.flatMap(() => Effect.failCause(cause)),
          ),
      ).pipe(Effect.annotateLogs({ requestId, scope: "ipc", "ipc.method": name }));
    }) as HandlerLike;
  }
  return out as T;
};
