type ErrorLike = {
  message?: unknown;
  statusCode?: unknown;
  status?: unknown;
  url?: unknown;
  code?: unknown;
};

function errorField(error: unknown, field: keyof ErrorLike): unknown {
  return typeof error === "object" && error !== null ? (error as ErrorLike)[field] : undefined;
}

export function formatAgentError(error: unknown): string {
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
