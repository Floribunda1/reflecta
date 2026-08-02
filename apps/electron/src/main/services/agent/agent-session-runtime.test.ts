import { describe, expect, test, vi } from "vitest";
import type { AgentSessionEvent, AgentSessionFeedFrame } from "@shared/agent";
import { AgentSessionRuntime } from "./agent-session-runtime";

const base = {
  sessionId: "session_1",
  runId: "run_1",
  createdAt: "2026-08-02T00:00:00.000Z",
};

function userMessage(id: string, text: string): AgentSessionEvent {
  return {
    ...base,
    id: `event_${id}`,
    type: "user.message",
    messageId: id,
    text,
  };
}

describe("AgentSessionRuntime", () => {
  test("sends one authoritative snapshot before ordered later states", async () => {
    const runtime = new AgentSessionRuntime(async () => [userMessage("user_1", "hello")]);
    const frames: AgentSessionFeedFrame[] = [];

    await runtime.watch("session_1", (frame) => frames.push(frame));
    runtime.apply({ ...base, id: "run_started", type: "run.started" });
    runtime.apply({
      ...base,
      id: "delta_1",
      type: "assistant.text.delta",
      messageId: "assistant_1",
      delta: "reply",
    });

    expect(frames.map((frame) => (frame.kind === "state" ? frame.revision : -1))).toEqual([
      0, 1, 2,
    ]);
    expect(frames.at(-1)).toMatchObject({
      kind: "state",
      session: {
        status: "running",
        messages: [
          { id: "user_1", text: "hello" },
          { id: "assistant_1", text: "reply" },
        ],
      },
    });
  });

  test("orders a branch replacement requested while the first watch is loading", async () => {
    let finishLoad!: (events: readonly AgentSessionEvent[]) => void;
    const runtime = new AgentSessionRuntime(
      () => new Promise<readonly AgentSessionEvent[]>((resolve) => (finishLoad = resolve)),
    );
    const frames: AgentSessionFeedFrame[] = [];

    const watching = runtime.watch("session_1", (frame) => frames.push(frame));
    const replacing = runtime.replace("session_1", [userMessage("user_1", "edited")]);
    finishLoad([userMessage("user_1", "old")]);
    await Promise.all([watching, replacing]);

    expect(frames).toMatchObject([
      { kind: "state", revision: 0, session: { messages: [{ text: "old" }] } },
      { kind: "state", revision: 1, session: { messages: [{ text: "edited" }] } },
    ]);
  });

  test("coalesces delivery without delaying projection updates", async () => {
    vi.useFakeTimers();
    try {
      const runtime = new AgentSessionRuntime(async () => []);
      const frames: AgentSessionFeedFrame[] = [];
      await runtime.watch("session_1", (frame) => frames.push(frame));

      runtime.apply(
        {
          ...base,
          id: "delta_1",
          type: "assistant.text.delta",
          messageId: "assistant_1",
          delta: "a",
        },
        "deferred",
      );
      runtime.apply(
        {
          ...base,
          id: "delta_2",
          type: "assistant.text.delta",
          messageId: "assistant_1",
          delta: "b",
        },
        "deferred",
      );

      expect((await runtime.projection("session_1")).messages[0]?.text).toBe("ab");
      expect(frames).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(16);
      expect(frames).toHaveLength(2);
      expect(frames[1]).toMatchObject({ kind: "state", revision: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  test("freezes the durable assistant turn from the live projection", async () => {
    const runtime = new AgentSessionRuntime(async () => []);
    await runtime.projection("session_1");
    runtime.apply({
      ...base,
      id: "delta_1",
      type: "assistant.text.delta",
      messageId: "assistant_1",
      delta: "reply",
    });

    const turn = runtime.assistantTurn({
      ...base,
      id: "turn_1",
      type: "assistant.turn",
      messageId: "assistant_1",
    });

    expect(runtime.hasAssistantContent("session_1", "assistant_1")).toBe(true);
    expect(turn).toMatchObject({
      text: "reply",
      blocks: [{ kind: "text", text: "reply", state: "done" }],
    });
  });

  test("uses the provider final text when no delta arrived", async () => {
    const runtime = new AgentSessionRuntime(async () => []);
    await runtime.projection("session_1");

    const turn = runtime.assistantTurn(
      {
        ...base,
        id: "turn_1",
        type: "assistant.turn",
        messageId: "assistant_1",
      },
      "final reply",
    );

    expect(turn).toMatchObject({
      text: "final reply",
      blocks: [{ kind: "text", text: "final reply", state: "done" }],
    });
  });

  test("replaces all branch-scoped state together", async () => {
    const abandonedCatalog: AgentSessionEvent = {
      ...base,
      id: "catalog_old",
      type: "entity.catalog.updated",
      entries: [
        {
          key: "understanding:old",
          entity: { type: "understanding", id: "old", title: "abandoned" },
          origin: { kind: "tool_result", toolCallId: "tool_old", toolName: "retrieve_knowledge" },
        },
      ],
    };
    const runtime = new AgentSessionRuntime(async () => [
      userMessage("user_1", "old"),
      abandonedCatalog,
    ]);
    await runtime.projection("session_1");

    const projection = await runtime.replace("session_1", [userMessage("user_1", "edited")]);

    expect(projection.messages).toMatchObject([{ id: "user_1", text: "edited" }]);
    expect(projection.entityCatalog).toEqual([]);
    expect(projection.contextCompactions).toEqual([]);
  });

  test("loads a session once and stops delivery after unsubscribe", async () => {
    const load = vi.fn(async () => []);
    const runtime = new AgentSessionRuntime(load);
    const first: AgentSessionFeedFrame[] = [];
    const second: AgentSessionFeedFrame[] = [];

    const unsubscribe = await runtime.watch("session_1", (frame) => first.push(frame));
    await runtime.watch("session_1", (frame) => second.push(frame));
    unsubscribe();
    runtime.apply({ ...base, id: "run_started", type: "run.started" });

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
  });
});
