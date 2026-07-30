// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import type { AgentReducedMessage } from "@shared/agent";
import { activeChatTurnIdAtViewport, buildChatTurnNavigationItems } from "./chat-turn-navigation";

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

describe("activeChatTurnIdAtViewport", () => {
  const turnAnchors = [
    { turnId: "turn-1", top: -1_600 },
    { turnId: "turn-2", top: -700 },
    { turnId: "turn-3", top: -120 },
  ];

  test("keeps the latest turn active throughout its long Agent response", () => {
    expect(
      activeChatTurnIdAtViewport({
        turnAnchors,
        viewportTop: 0,
        viewportHeight: 800,
      }),
    ).toBe("turn-3");
  });

  test("switches turns when the next user message reaches the reading line", () => {
    expect(
      activeChatTurnIdAtViewport({
        turnAnchors: [
          { turnId: "turn-1", top: 0 },
          { turnId: "turn-2", top: 705 },
        ],
        viewportTop: 0,
        viewportHeight: 800,
      }),
    ).toBe("turn-1");

    expect(
      activeChatTurnIdAtViewport({
        turnAnchors: [
          { turnId: "turn-1", top: 0 },
          { turnId: "turn-2", top: 704 },
        ],
        viewportTop: 0,
        viewportHeight: 800,
      }),
    ).toBe("turn-2");
  });

  test("has no active turn only when the conversation has no user turn", () => {
    expect(
      activeChatTurnIdAtViewport({
        turnAnchors: [{ turnId: "turn-1", top: 900 }],
        viewportTop: 0,
        viewportHeight: 800,
      }),
    ).toBe("turn-1");

    expect(
      activeChatTurnIdAtViewport({
        turnAnchors: [],
        viewportTop: 0,
        viewportHeight: 800,
      }),
    ).toBeNull();
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
