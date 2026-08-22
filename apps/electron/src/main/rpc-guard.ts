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
 * - 每次失败回调 onLog（供 main 接入 appLog：dev 走 console、prod 落文件、e2e 经 stdout 捕获）。
 */
export const rpcGuard =
  <ContractError>(
    toContract: (reason: string) => ContractError,
    options: { timeoutMs?: number; onLog?: (text: string) => void } = {},
  ) =>
  <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A, ContractError, R> => {
    const log = options.onLog ?? (() => {});
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
      Effect.catchCause((cause) =>
        Effect.sync(() => log(`rpc-unhandled ${Cause.squash(cause)}`)).pipe(
          Effect.flatMap(() => Effect.fail(resolveReason(cause))),
        ),
      ),
    );
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HandlerLike = (input: any, context: any) => Effect.Effect<unknown, any, never>;

/**
 * 对整个 handlers 对象包一次守卫（等价 HttpRouter.catchAll）：
 * 业务对象原样（纯 Effect、零仪式），每个方法按名字解析域错误构造器后经 rpcGuard 包裹。
 * 未映射的域原样透传。此后新增 API 只要加进对象即自动受保护。
 */
export const guardIpcHandlers = <T extends Record<string, HandlerLike>>(
  handlers: T,
  resolveCtor: (name: string) => ((reason: string) => unknown) | undefined,
  onLog?: (text: string) => void,
): T => {
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(handlers)) {
    const toContract = resolveCtor(name);
    out[name] = toContract
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (((input: any, context: any) =>
          rpcGuard(toContract as (reason: string) => never, { onLog })(
            fn(input, context),
          )) as HandlerLike)
      : fn;
  }
  return out as T;
};
