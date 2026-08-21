import { Effect } from "effect";
import { Cause, Option } from "effect";

/**
 * 全局错误兜底（对齐 Spring 的 @ControllerAdvice / GlobalExceptionHandler）：
 *
 * - 业务代码只要返回任意失败（typed TaggedError、裸 Error、defect、挂起），
 *   到这里统一裁决——业务不需要写任何 mapError / catch / log。
 * - 已知失败（带 message 的错误对象）→ `toContract(message)`（契约化，原因随行）。
 * - 未知 / defect → `toContract("操作失败：<cause>")`（带原文与堆栈的文本）。
 * - 超过 timeoutMs 未完成 → `toContract("操作超时")`（挂起变成可见的 typed 失败）。
 * - 所有失败都留下一笔 `Effect.logError` 日志（含 Cause）。
 *
 * 只在 IPC 注册处包一层，业务函数保持 `Effect<A, E, R>` 原样。
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
      // 已是契约错误（如“操作超时”）→ 原样透传，不再二次包装
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
      Effect.catchCause((cause) =>
        Effect.logError("rpc-unhandled", cause).pipe(
          Effect.flatMap(() => Effect.fail(resolveReason(cause))),
        ),
      ),
    );
  };
