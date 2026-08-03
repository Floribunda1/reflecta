// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import type { AgentReducedMessage } from "@shared/agent";
import { buildChatTurnNavigationItems } from "./chat-turn-navigation";

describe("buildChatTurnNavigationItems", () => {
  test("uses compact user message snippets for chat navigation", () => {
    const items = buildChatTurnNavigationItems([
      message("user-1", "user", "第一条\n用户消息"),
      message("assistant-1", "assistant", "第一条 Agent 回复"),
    ]);

    expect(items).toEqual([{ turnId: "user-1", label: "第一条 用户消息" }]);
  });

  test("keeps attachment-only turns jumpable", () => {
    const items = buildChatTurnNavigationItems([
      {
        ...message("user-1", "user", ""),
        files: [
          {
            type: "file",
            mediaType: "application/pdf",
            url: "file:///tmp/report.pdf",
            filename: "report.pdf",
          },
        ],
      },
    ]);

    expect(items[0]?.label).toBe("附件：report.pdf");
  });
});

function message(id: string, role: AgentReducedMessage["role"], text: string): AgentReducedMessage {
  return {
    id,
    role,
    text,
    createdAt: "2026-06-24T00:00:00.000Z",
  };
}
