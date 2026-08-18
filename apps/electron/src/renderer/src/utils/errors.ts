/** 未知错误 → 用户可读文案。message 属性优先，Error.message 其次，兜底通用文案。 */
export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}
