import { describe, expect, test } from "vitest";
import type { AgentSessionEvent } from "@shared/agent";
import { reduceAgentSession } from "@shared/agent";

const base = {
  sessionId: "session_1",
  runId: "run_1",
  createdAt: "2026-06-23T00:00:00.000Z",
};

describe("reduceAgentSession", () => {
  test("merges assistant text deltas and returns to idle after completion", () => {
    const events: AgentSessionEvent[] = [
      { ...base, id: "evt_1", type: "run.started" },
      {
        ...base,
        id: "evt_2",
        type: "user.message",
        messageId: "user_1",
        text: "hello",
      },
      {
        ...base,
        id: "evt_3",
        type: "assistant.text.delta",
        messageId: "assistant_1",
        delta: "hel",
      },
      {
        ...base,
        id: "evt_4",
        type: "assistant.text.delta",
        messageId: "assistant_1",
        delta: "lo",
      },
      { ...base, id: "evt_5", type: "run.completed" },
    ];

    const state = reduceAgentSession(events);

    expect(state.status).toBe("idle");
    expect(state.activeRunId).toBeNull();
    expect(state.messages).toEqual([
      {
        id: "user_1",
        role: "user",
        text: "hello",
        createdAt: "2026-06-23T00:00:00.000Z",
        contextRefs: undefined,
        composerContent: undefined,
      },
      {
        id: "assistant_1",
        role: "assistant",
        text: "hello",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ]);
    expect(reduceAgentSession(events)).toEqual(state);
  });

  test("clears the active run after failure", () => {
    const state = reduceAgentSession([
      { ...base, id: "evt_1", type: "run.started" },
      {
        ...base,
        id: "evt_2",
        type: "run.failed",
        error: "invalid api key",
      },
    ]);

    expect(state.status).toBe("failed");
    expect(state.activeRunId).toBeNull();
    expect(state.error).toBe("invalid api key");
  });

  test("clears the active run after cancellation", () => {
    const state = reduceAgentSession([
      { ...base, id: "evt_1", type: "run.started" },
      { ...base, id: "evt_2", type: "run.cancelled" },
    ]);

    expect(state.status).toBe("cancelled");
    expect(state.activeRunId).toBeNull();
    expect(state.error).toBeNull();
  });

  test("keeps user message attachments in reduced state", () => {
    const state = reduceAgentSession([
      {
        ...base,
        id: "evt_1",
        type: "user.message",
        messageId: "user_1",
        text: "请总结附件",
        files: [
          {
            type: "file",
            mediaType: "text/plain",
            filename: "note.txt",
            url: "data:text/plain;base64,aGVsbG8=",
          },
        ],
      },
    ]);

    expect(state.messages[0]?.files).toEqual([
      {
        type: "file",
        mediaType: "text/plain",
        filename: "note.txt",
        url: "data:text/plain;base64,aGVsbG8=",
      },
    ]);
  });
});
