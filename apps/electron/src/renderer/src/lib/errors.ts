/**
 * renderer 统一错误渲染（P4-2A：错误处理层 Effect-native）。
 *
 * 替代旧的 `utils/errors.ts` message 兜底：所有 `rpc.*` / 域 mutation 抛出的
 * 都是 `Schema.TaggedError`（`_tag` + 结构化字段）。这里按 typed error 的结构
 * 提取用户可读文案：
 *   - 优先 `reason`（各域错误的主消息字段）；
 *   - 其次 `message`；
 *   - 再按 `_tag` 兜底（可调试、保留类型身份）；
 *   - 最后 `Error.message` / 通用文案。
 *
 * 调用侧在跑 Effect 的流程里用 `Effect.catchTag` 处理已知错误、`Effect.catch`
 * 统一兜底到此函数；Promise-land（React Query mutateAsync / runPromise 拒绝）用
 * 本函数渲染 reject 的 typed error。
 */

function readDetail(value: unknown): string {
  if (value && typeof value === "object") {
    const e = value as { reason?: unknown; message?: unknown; _tag?: unknown };
    if (typeof e.reason === "string" && e.reason) return e.reason;
    if (typeof e.message === "string" && e.message) return e.message;
    if (typeof e._tag === "string" && e._tag) return `操作失败（${e._tag}）`;
  }
  return value instanceof Error ? value.message : "";
}

/** 把任意 throwable（优先 typed domain error）渲染成用户可读文案。 */
export function renderError(error: unknown): string {
  const detail = readDetail(error);
  return detail || "请稍后重试";
}
