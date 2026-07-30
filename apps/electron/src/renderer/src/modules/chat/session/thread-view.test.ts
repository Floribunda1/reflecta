// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import type { AgentEvent, AgentReducedMessage } from "@shared/agent";
import {
  activeAssistantMessageId,
  buildChatFindMatches,
  mergeAgentEvents,
  scrollTopForChildBottom,
  shouldShowScrollToBottomButton,
} from "./thread-view";

describe("mergeAgentEvents", () => {
  test("keeps live events that arrive before history finishes loading without duplicating history", () => {
    const historical = [event("history"), event("shared")];
    const live = [event("shared"), event("live")];

    expect(mergeAgentEvents(historical, live).map((item) => item.id)).toEqual([
      "history",
      "shared",
      "live",
    ]);
  });
});

describe("shouldShowScrollToBottomButton", () => {
  test("shows the button after scrolling away from the bottom", () => {
    expect(
      shouldShowScrollToBottomButton({
        scrollHeight: 1_000,
        scrollTop: 500,
        clientHeight: 300,
      }),
    ).toBe(true);
  });

  test("hides the button near the bottom", () => {
    expect(
      shouldShowScrollToBottomButton({
        scrollHeight: 1_000,
        scrollTop: 620,
        clientHeight: 300,
      }),
    ).toBe(false);
  });
});

describe("scrollTopForChildBottom", () => {
  test("aligns the target message to the bottom of the scroll viewport", () => {
    expect(
      scrollTopForChildBottom({
        scrollTop: 400,
        containerBottom: 900,
        childBottom: 1_200,
        bottomOffset: 24,
      }),
    ).toBe(724);
  });

  test("does not scroll above the start", () => {
    expect(
      scrollTopForChildBottom({
        scrollTop: 20,
        containerBottom: 900,
        childBottom: 300,
        bottomOffset: 24,
      }),
    ).toBe(0);
  });
});

describe("buildChatFindMatches", () => {
  test("returns each matching occurrence in chat message text", () => {
    const items = buildChatFindMatches(
      [
        message("user-1", "user", "Find this in the prompt. find this again."),
        message("assistant-1", "assistant", "No match here"),
        message("assistant-2", "assistant", "find this in the reply"),
      ],
      "FIND THIS",
    );

    expect(items).toEqual([
      { messageId: "user-1", matchIndex: 0, role: "user" },
      { messageId: "user-1", matchIndex: 1, role: "user" },
      { messageId: "assistant-2", matchIndex: 0, role: "assistant" },
    ]);
  });

  test("returns no matches for blank queries", () => {
    expect(buildChatFindMatches([message("user-1", "user", "hello")], "   ")).toEqual([]);
  });
});

describe("activeAssistantMessageId", () => {
  test("matches the active run instead of the previous assistant position", () => {
    const messages = [
      { ...message("assistant-old", "assistant", "old response"), runId: "run-old" },
      message("user-new", "user", "new prompt"),
    ];

    expect(activeAssistantMessageId(messages, "run-new")).toBeUndefined();
    expect(activeAssistantMessageId(messages, "run-old")).toBe("assistant-old");
    expect(activeAssistantMessageId(messages, null)).toBeUndefined();
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

function event(id: string): AgentEvent {
  return {
    id,
    type: "run.started",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-06-24T00:00:00.000Z",
  };
}
