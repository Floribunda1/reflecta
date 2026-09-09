import { describe, expect, test } from "vitest";
import {
  clampConversationReadMaxChars,
  conversationMessagesToMarkdown,
  DEFAULT_CONVERSATION_READ_MAX_CHARS,
  HARD_CONVERSATION_READ_MAX_CHARS,
} from "./conversation-markdown";

const user = (text: string) => ({ role: "user" as const, text });
const agent = (text: string) => ({ role: "assistant" as const, text });

describe("conversationMessagesToMarkdown", () => {
  test("renders title and messages with role headings", () => {
    const result = conversationMessagesToMarkdown({
      title: "交易复盘",
      messages: [user("为什么亏了？"), agent("执行纪律崩了。")],
      mode: "keep-references",
    });
    expect(result.markdown).toBe(
      "# 交易复盘\n\n## 用户\n\n为什么亏了？\n\n## Agent\n\n执行纪律崩了。",
    );
    expect(result.messageCount).toBe(2);
    expect(result.keptMessageCount).toBe(2);
    expect(result.truncated).toBe(false);
  });

  test("skips empty messages and falls back title", () => {
    const result = conversationMessagesToMarkdown({
      title: "   ",
      messages: [user("  "), agent("回答")],
      mode: "keep-references",
    });
    expect(result.markdown).toBe("# Agent 对话\n\n## Agent\n\n回答");
  });

  test("keep-references preserves wiki links", () => {
    const result = conversationMessagesToMarkdown({
      title: "T",
      messages: [user("看下 [[u:u_1]] 和 [[s:s_2]]")],
      mode: "keep-references",
    });
    expect(result.markdown).toContain("[[u:u_1]]");
    expect(result.markdown).toContain("[[s:s_2]]");
  });

  test("replace-references swaps wiki links for labels and falls back to source", () => {
    const labels = new Map([["understanding:u_1", "重复会重塑大脑"]]);
    const result = conversationMessagesToMarkdown({
      title: "T",
      messages: [user("看下 [[u:u_1]] 和 [[c:c_1]]")],
      mode: "replace-references",
      labels,
    });
    expect(result.markdown).toContain("看下 重复会重塑大脑 和 [[c:c_1]]");
  });

  test("keeps the tail when over budget and marks truncated", () => {
    const result = conversationMessagesToMarkdown({
      title: "T",
      messages: [user("a".repeat(200)), agent("b".repeat(200)), user("最新消息")],
      mode: "keep-references",
      maxChars: 260,
    });
    expect(result.truncated).toBe(true);
    expect(result.markdown).toContain("最新消息");
    expect(result.markdown).not.toContain("a".repeat(200));
    expect(result.markdown).toContain("仅显示最近 2 / 3 条消息");
    expect(result.keptMessageCount).toBe(2);
  });

  test("barely fits with no truncation", () => {
    const result = conversationMessagesToMarkdown({
      title: "T",
      messages: [user("短消息"), agent("短回")],
      mode: "keep-references",
      maxChars: 10_000,
    });
    expect(result.truncated).toBe(false);
    expect(result.markdown).toContain("短消息");
    expect(result.markdown).toContain("短回");
  });
});

describe("clampConversationReadMaxChars", () => {
  test("defaults when omitted or non-finite", () => {
    expect(clampConversationReadMaxChars(undefined)).toBe(DEFAULT_CONVERSATION_READ_MAX_CHARS);
    expect(clampConversationReadMaxChars(Number.NaN)).toBe(DEFAULT_CONVERSATION_READ_MAX_CHARS);
  });
  test("clamps into [1, hard] and floors", () => {
    expect(clampConversationReadMaxChars(0)).toBe(1);
    expect(clampConversationReadMaxChars(999_999)).toBe(HARD_CONVERSATION_READ_MAX_CHARS);
    expect(clampConversationReadMaxChars(12.9)).toBe(12);
  });
});
