import { describe, expect, test } from "vitest";
import { formatAgentError } from "./error";

describe("formatAgentError", () => {
  test("keeps missing config messages actionable", () => {
    expect(formatAgentError(new Error("请先在设置中配置 AI Provider"))).toBe(
      "请先在设置中配置 AI Provider",
    );
  });

  test("classifies provider 404s", () => {
    expect(formatAgentError({ statusCode: 404, url: "https://api.deepseek.com/responses" })).toBe(
      "AI API Not Found: 请检查 Base URL、模型和 provider 是否匹配。当前 OpenAI-compatible 模型需要 chat completions。 (https://api.deepseek.com/responses)",
    );
  });

  test("classifies common network failures", () => {
    expect(formatAgentError({ code: "ETIMEDOUT" })).toBe(
      "网络请求失败：请检查网络连接或 AI Provider 地址。",
    );
  });
});
