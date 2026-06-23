import { describe, expect, test } from "vitest";
import type { AgentReducedMessage } from "@shared/agent";
import {
  buildContextUsageRequest,
  contextUsageLabel,
  contextUsageMeterLabel,
  contextWindowForModel,
} from "./context-usage";

function userMessage(text: string): AgentReducedMessage {
  return {
    id: "user-1",
    role: "user",
    text,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}

describe("context usage", () => {
  test("uses built-in model context windows", () => {
    expect(contextWindowForModel({ providerId: "openai", modelId: "gpt-4o" })).toBe(128_000);
    expect(contextWindowForModel({ providerId: "moonshot", modelId: "moonshot-v1-8k" })).toBe(
      8_192,
    );
    expect(contextWindowForModel({ providerId: "custom", modelId: "unknown" })).toBeUndefined();
  });

  test("builds prompt usage input with selected refs", () => {
    const request = buildContextUsageRequest({
      messages: [userMessage("帮我整理这条笔记")],
      draft: "继续分析",
      selectedContexts: [{ type: "understanding", id: "understanding-1", title: "拖延" }],
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    expect(request.input).toContain("帮我整理这条笔记");
    expect(request.input).toContain("继续分析");
    expect(request.input).toContain("拖延");
    expect(request.contextWindow).toBe(128_000);
    expect(request.selectedContextCount).toBe(1);
  });

  test("formats usage labels for the compact meter", () => {
    const usage = {
      tokens: 1_500,
      contextWindow: 128_000,
      selectedContextCount: 1,
    };

    expect(usage.tokens).toBeGreaterThan(0);
    expect(contextUsageMeterLabel(usage)).toBe("1.2%");
    expect(contextUsageLabel(usage)).toBe("1.2% · 1.5K / 128K 已使用上下文");
  });
});
