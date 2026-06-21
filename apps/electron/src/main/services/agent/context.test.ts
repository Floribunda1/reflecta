import { describe, expect, test } from "vitest";
import type { AgentChatMessage } from "@shared/chat";
import { buildSelectedContextBlock } from "./context";

describe("buildSelectedContextBlock", () => {
  test("passes only selected refs, not hidden knowledge content", async () => {
    const messages: AgentChatMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "聊聊 @拖延" }],
        metadata: {
          contextRefs: [{ type: "thought", id: "thought-1", title: "拖延" }],
        },
      },
    ];

    const block = await buildSelectedContextBlock(messages);

    expect(block).toContain("thought: 拖延 (id: thought-1)");
    expect(block).toContain("轻量引用");
    expect(block).not.toContain("body:");
    expect(block).not.toContain("contexts:");
  });

  test("limits selected refs in the prompt block", async () => {
    const messages: AgentChatMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "比较这些分类" }],
        metadata: {
          contextRefs: Array.from({ length: 9 }, (_, index) => ({
            type: "category",
            id: `category-${index + 1}`,
            title: `分类 ${index + 1}`,
          })),
        },
      },
    ];

    const block = await buildSelectedContextBlock(messages);

    expect(block).toContain("category-8");
    expect(block).not.toContain("category-9");
  });
});
