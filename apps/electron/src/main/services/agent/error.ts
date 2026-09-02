type ErrorLike = {
  message?: unknown;
  statusCode?: unknown;
  status?: unknown;
  url?: unknown;
  code?: unknown;
  _tag?: unknown;
  id?: unknown;
  domainId?: unknown;
  understandingId?: unknown;
  contextId?: unknown;
};

function errorField(error: unknown, field: keyof ErrorLike): unknown {
  return typeof error === "object" && error !== null ? (error as ErrorLike)[field] : undefined;
}

function taggedDomainErrorId(error: unknown): string | undefined {
  for (const field of ["id", "domainId", "understandingId", "contextId"] as const) {
    const value = errorField(error, field);
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

/** Schema.TaggedError 的 message 多为空；CLI runner 已按 `_tag` 映射，Agent 工具路径必须同样处理。 */
export function formatTaggedDomainError(error: unknown): string | undefined {
  const tag = errorField(error, "_tag");
  if (typeof tag !== "string" || tag.length === 0) return undefined;
  if (!tag.endsWith("NotFoundError")) return undefined;
  const subject = tag.replace(/NotFoundError$/, "") || "Entity";
  const id = taggedDomainErrorId(error);
  return id ? `${subject} not found: ${id}` : `${subject} not found`;
}

export function formatAgentError(error: unknown): string {
  const tagged = formatTaggedDomainError(error);
  if (tagged) return tagged;
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const statusCode = errorField(error, "statusCode") ?? errorField(error, "status");
  const url = errorField(error, "url");
  const code = errorField(error, "code");

  if (message.includes("请先在设置中配置 AI Provider")) {
    return message;
  }

  if (statusCode === 404) {
    return `AI API Not Found: 请检查 Base URL、模型和 provider 是否匹配。当前 OpenAI-compatible 模型需要 chat completions。${typeof url === "string" ? ` (${url})` : ""}`;
  }

  if (code === "ENOTFOUND" || code === "ECONNRESET" || code === "ETIMEDOUT") {
    return "网络请求失败：请检查网络连接或 AI Provider 地址。";
  }

  return message;
}
