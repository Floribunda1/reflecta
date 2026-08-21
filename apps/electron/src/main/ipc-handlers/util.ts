/**
 * IPC handler 模块共享工具。
 *
 * 各域 handler 模块（本目录）只做薄封装：Effect 服务直通、非 Effect 操作抬升为
 * Effect、成功值 void 归一；域契约错误构造器就近声明，由 index.ts 汇总喂给 rpc-guard。
 */
import { Effect } from "effect";
import type { HandlerLike } from "../rpc-guard";

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** 抬升 promise 操作：失败折叠为该域契约错误。 */
export const liftPromise = <A>(toError: (message: string) => unknown, fn: () => Promise<A>) =>
  Effect.tryPromise({ try: fn, catch: (e) => toError(message(e)) });

/** 抬升同步操作：失败折叠为该域契约错误。 */
export const liftSync = <A>(toError: (message: string) => unknown, fn: () => A) =>
  Effect.try({ try: fn, catch: (e) => toError(message(e)) });

/** 成功值映射为 undefined（对齐契约的 void 输出）。 */
export const toVoid = <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<void, E, R> =>
  program.pipe(Effect.map(() => undefined));

/**
 * 一个域 handler 模块：域前缀 + 可选契约错误构造器 + handlers。
 * error 缺省 = 该域不纳入 rpcGuard（原样透传，与既有行为一致）。
 */
export interface HandlerModule {
  domain: string;
  error?: (message: string) => unknown;
  handlers: Record<string, HandlerLike>;
}
