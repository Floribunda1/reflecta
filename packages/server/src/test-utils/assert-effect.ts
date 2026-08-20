import { Cause, Effect, Exit, Option } from "effect";

/**
 * 断言一个 Effect 程序以 **typed failure** 结束，并对失败值执行断言。
 *
 * 替代旧的 `.rejects.toMatchObject({ _tag })` 写法：该写法无法区分 typed
 * failure 与 defect（defect 的 rejection 也携带同样的错误对象），会掩盖
 * “错误类型签名是假的”这类回归（如 `Effect.promise` 内 `throw`）。
 */
export async function expectEffectFailure<A, E>(
  effect: Effect.Effect<A, E>,
  assert: (error: E) => void,
): Promise<void> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    throw new Error(`Expected effect to fail, but it succeeded with ${JSON.stringify(exit.value)}`);
  }
  const error = Cause.findErrorOption(exit.cause);
  if (Option.isNone(error)) {
    throw new Error(
      `Expected a typed failure, but the effect ended without one (cause: ${Cause.pretty(exit.cause)})`,
    );
  }
  assert(error.value);
}
