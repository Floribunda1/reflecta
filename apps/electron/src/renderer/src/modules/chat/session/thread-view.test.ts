// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import { reduceAgentSession, type AgentEvent, type AgentReducedMessage } from "@shared/agent";
import {
  activeAssistantMessageId,
  buildChatFindMatches,
  mergeAgentEvents,
  scrollTopForChildBottom,
  shouldShowScrollToBottomButton,
} from "./thread-view";

describe("mergeAgentEvents", () => {
  test("keeps live events that arrive before history finishes loading without duplicating history", () => {
    const historical = [event("history", "run-history"), event("shared", "run-history")];
    const live = [event("shared", "run-history"), event("live", "run-live")];

    expect(mergeAgentEvents(historical, live).map((item) => item.id)).toEqual([
      "history",
      "shared",
      "live",
    ]);
  });

  test("does not replay an abandoned live branch after history switches to an edited branch", () => {
    const base = {
      sessionId: "session-1",
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    const historical: AgentEvent[] = [
      { ...base, id: "new-run", runId: "run-new", type: "run.started" },
      {
        ...base,
        id: "new-user",
        runId: "run-new",
        type: "user.message",
        messageId: "user-1",
        text: "edited prompt",
      },
      {
        ...base,
        id: "new-snapshot",
        runId: "run-new",
        type: "assistant.turn",
        messageId: "assistant-new",
        text: "new reply",
        blocks: [{ kind: "text", text: "new reply", createdAt: base.createdAt }],
      },
    ];
    const live: AgentEvent[] = [
      { ...base, id: "old-run", runId: "run-old", type: "run.started" },
      {
        ...base,
        id: "old-user",
        runId: "run-old",
        type: "user.message",
        messageId: "user-1",
        text: "original prompt",
      },
      {
        ...base,
        id: "old-reply",
        runId: "run-old",
        type: "assistant.turn",
        messageId: "assistant-old",
        text: "old reply",
        blocks: [{ kind: "text", text: "old reply", createdAt: base.createdAt }],
      },
      { ...base, id: "old-completed", runId: "run-old", type: "run.completed" },
      historical[0]!,
      historical[1]!,
    ];

    expect(
      reduceAgentSession(mergeAgentEvents(historical, live)).messages.map((message) => [
        message.role,
        message.text,
      ]),
    ).toEqual([
      ["user", "edited prompt"],
      ["assistant", "new reply"],
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

function event(id: string, runId = "run-1"): AgentEvent {
  return {
    id,
    type: "run.started",
    sessionId: "session-1",
    runId,
    createdAt: "2026-06-24T00:00:00.000Z",
  };
}
