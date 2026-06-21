// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import type { AgentChatMessage } from "@shared/chat";
import { scrollKeyFor, shouldShowScrollToBottomButton } from "./thread-view";

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

describe("scrollKeyFor", () => {
  test("changes when streamed reasoning grows", () => {
    const message: AgentChatMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "reasoning", text: "a", state: "streaming" }],
    };

    const before = scrollKeyFor([message]);
    const after = scrollKeyFor([
      { ...message, parts: [{ type: "reasoning", text: "abc", state: "streaming" }] },
    ]);

    expect(after).not.toBe(before);
  });

  test("changes when a tool output becomes available", () => {
    const message: AgentChatMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-thought_list",
          toolCallId: "call-1",
          state: "input-available",
          input: {},
        } as AgentChatMessage["parts"][number],
      ],
    };

    const before = scrollKeyFor([message]);
    const after = scrollKeyFor([
      {
        ...message,
        parts: [
          {
            type: "tool-thought_list",
            toolCallId: "call-1",
            state: "output-available",
            input: {},
            output: [{ id: "thought-1" }],
          } as AgentChatMessage["parts"][number],
        ],
      },
    ]);

    expect(after).not.toBe(before);
  });
});
