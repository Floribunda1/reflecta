import { describe, expect, test } from "vitest";
import type { AgentReducedMessage } from "@shared/agent";
import {
  contextUsageFromMessages,
  contextUsageLabel,
  contextUsageMeterLabel,
} from "./context-usage";

function assistantMessage(
  id: string,
  tokens: number | null,
  contextWindow: number,
): AgentReducedMessage {
  return {
    id,
    role: "assistant",
    text: "完成",
    createdAt: "2026-06-23T00:00:00.000Z",
    contextUsage: {
      tokens,
      contextWindow,
      percent: tokens === null ? null : (tokens / contextWindow) * 100,
    },
  };
}

describe("context usage", () => {
  test("waits for provider usage before showing context used", () => {
    const usage = contextUsageFromMessages([], 2);

    expect(usage).toEqual({ selectedContextCount: 2 });
    expect(contextUsageMeterLabel(usage)).toBe("--");
    expect(contextUsageLabel(usage)).toBe("等待上次请求 usage");
  });

  test("uses the latest assistant context usage", () => {
    const usage = contextUsageFromMessages(
      [
        assistantMessage("assistant_1", 1_500, 128_000),
        assistantMessage("assistant_2", 21_700, 128_000),
      ],
      1,
    );

    expect(usage).toEqual({
      tokens: 21_700,
      contextWindow: 128_000,
      percent: 16.953125,
      selectedContextCount: 1,
    });
    expect(contextUsageMeterLabel(usage)).toBe("17%");
    expect(contextUsageLabel(usage)).toBe("上次上下文：21.7K / 128K");
  });

  test("preserves selected context count without treating refs as full context", () => {
    const usage = contextUsageFromMessages([assistantMessage("assistant_1", null, 128_000)], 3);

    expect(usage).toEqual({
      tokens: null,
      contextWindow: 128_000,
      percent: null,
      selectedContextCount: 3,
    });
    expect(contextUsageMeterLabel(usage)).toBe("--");
    expect(contextUsageLabel(usage)).toBe("等待上次请求 usage");
  });
});
