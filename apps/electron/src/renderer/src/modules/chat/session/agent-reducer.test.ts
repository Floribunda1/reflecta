import { describe, expect, test } from "vitest";
import type { AgentEvent, AgentSessionEvent } from "@shared/agent";
import {
  initialAgentSessionState,
  reduceAgentSession,
  reduceAgentSessionEvent,
} from "@shared/agent";

const base = {
  sessionId: "session_1",
  runId: "run_1",
  createdAt: "2026-06-23T00:00:00.000Z",
};

describe("reduceAgentSession", () => {
  test("restores entity sources from session events", () => {
    const events: AgentSessionEvent[] = [
      {
        ...base,
        id: "evt_1",
        type: "entity.sources.updated",
        sources: [
          {
            sourceId: "S1",
            entity: { type: "context", id: "ctx_1", title: "一次产品复盘" },
            origin: { kind: "user_context", messageId: "user_1" },
          },
        ],
      },
      {
        ...base,
        id: "evt_2",
        type: "entity.sources.updated",
        sources: [
          {
            sourceId: "S1",
            entity: { type: "context", id: "ctx_1", title: "更新后的标题" },
            origin: { kind: "user_context", messageId: "user_1" },
          },
          {
            sourceId: "S2",
            entity: { type: "understanding", id: "u_1", title: "Feedback Loop" },
            origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
          },
        ],
      },
    ];

    const state = reduceAgentSession(events);

    expect(state.entitySources).toEqual([
      {
        sourceId: "S1",
        entity: { type: "context", id: "ctx_1", title: "更新后的标题" },
        origin: { kind: "user_context", messageId: "user_1" },
      },
      {
        sourceId: "S2",
        entity: { type: "understanding", id: "u_1", title: "Feedback Loop" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
      },
    ]);
  });

  test("restores assistant turns and returns to idle after completion", () => {
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
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "hello",
        blocks: [{ kind: "text", text: "hello", createdAt: base.createdAt }],
        usage: {
          input: 21_000,
          output: 700,
          cacheRead: 100_000,
          cacheWrite: 0,
          totalTokens: 121_700,
        },
        contextUsage: {
          tokens: 121_700,
          contextWindow: 128_000,
          percent: 95.078125,
        },
        model: { providerId: "openai", modelId: "gpt-5.3-codex-spark" },
        stopReason: "stop",
      },
      { ...base, id: "evt_4", type: "run.completed" },
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
        files: undefined,
        composerContent: undefined,
      },
      {
        id: "assistant_1",
        role: "assistant",
        text: "hello",
        runId: "run_1",
        createdAt: "2026-06-23T00:00:00.000Z",
        blocks: [
          {
            kind: "text",
            text: "hello",
            createdAt: "2026-06-23T00:00:00.000Z",
          },
        ],
        usage: {
          input: 21_000,
          output: 700,
          cacheRead: 100_000,
          cacheWrite: 0,
          totalTokens: 121_700,
        },
        contextUsage: {
          tokens: 121_700,
          contextWindow: 128_000,
          percent: 95.078125,
        },
        model: { providerId: "openai", modelId: "gpt-5.3-codex-spark" },
        stopReason: "stop",
      },
    ]);
    expect(reduceAgentSession(events)).toEqual(state);
  });

  test("keeps reasoning, tool activity, and final text in event order", () => {
    const events: AgentEvent[] = [
      { ...base, id: "evt_1", type: "run.started" },
      {
        ...base,
        id: "evt_2",
        type: "assistant.reasoning.delta",
        messageId: "assistant_1",
        delta: "先搜索",
      },
      {
        ...base,
        id: "evt_3",
        type: "tool.started",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "search",
        input: { query: "React Server Components" },
      },
      {
        ...base,
        id: "evt_4",
        type: "tool.completed",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "search",
        output: { hits: [{ type: "understanding", understanding: { id: "understanding_1" } }] },
      },
      {
        ...base,
        id: "evt_5",
        type: "assistant.text.delta",
        messageId: "assistant_1",
        delta: "找到相关内容。",
      },
      { ...base, id: "evt_6", type: "run.completed" },
    ];

    const state = reduceAgentSession(events);

    expect(state.messages[0]?.blocks?.map((block) => block.kind)).toEqual([
      "reasoning",
      "tool",
      "text",
    ]);
    expect(state.messages[0]?.blocks?.[1]).toMatchObject({
      kind: "tool",
      toolCallId: "tool_1",
      toolName: "search",
      state: "completed",
      input: { query: "React Server Components" },
      output: { hits: [{ type: "understanding", understanding: { id: "understanding_1" } }] },
    });
    expect(reduceAgentSession(events)).toEqual(state);
  });

  test("keeps interleaved reasoning and tool events in source order", () => {
    const events: AgentEvent[] = [
      { ...base, id: "evt_1", type: "run.started" },
      {
        ...base,
        id: "evt_2",
        type: "assistant.reasoning.delta",
        messageId: "assistant_1",
        delta: "先做第一轮搜索。",
      },
      {
        ...base,
        id: "evt_3",
        type: "tool.started",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "search",
      },
      {
        ...base,
        id: "evt_4",
        type: "tool.completed",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "search",
        output: { hits: [{ type: "understanding", understanding: { id: "understanding_1" } }] },
      },
      {
        ...base,
        id: "evt_5",
        type: "assistant.reasoning.delta",
        messageId: "assistant_1",
        delta: "看完结果后再读取详情。",
      },
      {
        ...base,
        id: "evt_6",
        type: "tool.started",
        messageId: "assistant_1",
        toolCallId: "tool_2",
        toolName: "understanding_get",
      },
      {
        ...base,
        id: "evt_7",
        type: "tool.completed",
        messageId: "assistant_1",
        toolCallId: "tool_2",
        toolName: "understanding_get",
        output: { understanding: { id: "understanding_1", title: "Feedback Loop" } },
      },
      {
        ...base,
        id: "evt_8",
        type: "assistant.text.delta",
        messageId: "assistant_1",
        delta: "最终答案。",
      },
    ];

    const blocks = reduceAgentSession(events).messages[0]?.blocks;

    expect(blocks?.map((block) => block.kind)).toEqual([
      "reasoning",
      "tool",
      "reasoning",
      "tool",
      "text",
    ]);
    expect(blocks?.[0]).toMatchObject({ kind: "reasoning", text: "先做第一轮搜索。" });
    expect(blocks?.[2]).toMatchObject({ kind: "reasoning", text: "看完结果后再读取详情。" });
  });

  test("replaces an edited user message and truncates following assistant output", () => {
    const state = reduceAgentSession([
      { ...base, id: "evt_1", type: "run.started" },
      { ...base, id: "evt_2", type: "user.message", messageId: "user_1", text: "old" },
      {
        ...base,
        id: "evt_3",
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "old reply",
        blocks: [{ kind: "text", text: "old reply", createdAt: base.createdAt }],
      },
      { ...base, id: "evt_4", type: "run.completed" },
      { ...base, id: "evt_5", type: "run.started", runId: "run_2" },
      {
        ...base,
        id: "evt_6",
        type: "user.message",
        runId: "run_2",
        messageId: "user_1",
        text: "edited",
      },
      {
        ...base,
        id: "evt_7",
        type: "assistant.turn",
        runId: "run_2",
        messageId: "assistant_2",
        text: "new reply",
        blocks: [{ kind: "text", text: "new reply", createdAt: base.createdAt }],
      },
    ]);

    expect(state.messages.map((message) => [message.role, message.text])).toEqual([
      ["user", "edited"],
      ["assistant", "new reply"],
    ]);
  });

  test("reduces approval requested, rejected, and completed states", () => {
    const requested: AgentSessionEvent = {
      ...base,
      id: "evt_1",
      type: "approval.requested",
      messageId: "assistant_1",
      approvalId: "approval_1",
      toolCallId: "tool_1",
      toolName: "understanding_create",
      title: "候选 Understanding",
      payload: { title: "A", body: "B" },
    };

    expect(
      reduceAgentSession([
        requested,
        {
          ...base,
          id: "evt_2",
          type: "approval.resolved",
          messageId: "assistant_1",
          approvalId: "approval_1",
          toolCallId: "tool_1",
          toolName: "understanding_create",
          approved: false,
        },
      ]).messages[0]?.blocks?.[0],
    ).toMatchObject({ kind: "approval", approvalId: "approval_1", state: "rejected" });

    expect(
      reduceAgentSession([
        requested,
        {
          ...base,
          id: "evt_3",
          type: "approval.resolved",
          messageId: "assistant_1",
          approvalId: "approval_1",
          toolCallId: "tool_1",
          toolName: "understanding_create",
          approved: true,
        },
        {
          ...base,
          id: "evt_4",
          type: "tool.completed",
          messageId: "assistant_1",
          toolCallId: "tool_1",
          toolName: "understanding_create",
          output: { resultRefType: "understanding", resultRefId: "understanding_1" },
        },
      ]).messages[0]?.blocks?.[0],
    ).toMatchObject({
      kind: "approval",
      approvalId: "approval_1",
      state: "completed",
      approved: true,
      output: { resultRefType: "understanding", resultRefId: "understanding_1" },
    });

    const directCompletion = reduceAgentSession([
      requested,
      {
        ...base,
        id: "evt_5",
        type: "tool.completed",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "understanding_create",
        output: { resultRefType: "understanding", resultRefId: "understanding_2" },
      },
    ]).messages[0]?.blocks?.[0];

    expect(directCompletion).toMatchObject({
      kind: "approval",
      approvalId: "approval_1",
      state: "completed",
      output: { resultRefType: "understanding", resultRefId: "understanding_2" },
    });
    expect(directCompletion).not.toHaveProperty("approved");
  });

  test("reduces approved tool execution failure onto the proposal block", () => {
    const state = reduceAgentSession([
      {
        ...base,
        id: "evt_1",
        type: "approval.requested",
        messageId: "assistant_1",
        approvalId: "approval_1",
        toolCallId: "tool_1",
        toolName: "understanding_update",
        title: "候选修改 Understanding",
        payload: { understandingId: "understanding_1", domainIds: ["domain_1"] },
      },
      {
        ...base,
        id: "evt_2",
        type: "approval.resolved",
        messageId: "assistant_1",
        approvalId: "approval_1",
        toolCallId: "tool_1",
        toolName: "understanding_update",
        approved: true,
      },
      {
        ...base,
        id: "evt_3",
        type: "tool.execution.started",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "understanding_update",
      },
      {
        ...base,
        id: "evt_4",
        type: "tool.execution.failed",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "understanding_update",
        error: { message: "Domain not found: domain_1" },
      },
    ]);

    expect(state.messages[0]?.blocks?.[0]).toMatchObject({
      kind: "approval",
      approvalId: "approval_1",
      toolName: "understanding_update",
      approved: true,
      approvalState: "approved",
      executionState: "failed",
      displayState: "failed",
      state: "failed",
      error: "Domain not found: domain_1",
      executionError: { message: "Domain not found: domain_1" },
    });
  });

  test("keeps approved tool execution failure when assistant turn snapshot arrives later", () => {
    const state = reduceAgentSession([
      {
        ...base,
        id: "evt_1",
        type: "approval.requested",
        messageId: "assistant_1",
        approvalId: "approval_1",
        toolCallId: "tool_1",
        toolName: "understanding_update",
        title: "候选修改 Understanding",
        payload: { understandingId: "understanding_1", domainIds: ["domain_1"] },
      },
      {
        ...base,
        id: "evt_2",
        type: "approval.resolved",
        messageId: "assistant_1",
        approvalId: "approval_1",
        toolCallId: "tool_1",
        toolName: "understanding_update",
        approved: true,
      },
      {
        ...base,
        id: "evt_3",
        type: "tool.execution.failed",
        messageId: "assistant_1",
        toolCallId: "tool_1",
        toolName: "understanding_update",
        error: { message: "Domain not found: domain_1" },
      },
      {
        ...base,
        id: "evt_4",
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "",
        blocks: [
          {
            kind: "approval",
            approvalId: "approval_1",
            toolCallId: "tool_1",
            toolName: "understanding_update",
            title: "候选修改 Understanding",
            payload: { understandingId: "understanding_1", domainIds: ["domain_1"] },
            approved: true,
            state: "approved",
            createdAt: base.createdAt,
          },
        ],
      },
    ]);

    expect(state.messages[0]?.blocks?.[0]).toMatchObject({
      kind: "approval",
      approvalId: "approval_1",
      approved: true,
      approvalState: "approved",
      executionState: "failed",
      displayState: "failed",
      state: "failed",
      error: "Domain not found: domain_1",
      executionError: { message: "Domain not found: domain_1" },
    });
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
            filename: "attachment.txt",
            url: "data:text/plain;base64,aGVsbG8=",
          },
        ],
      },
    ]);

    expect(state.messages[0]?.files).toEqual([
      {
        type: "file",
        mediaType: "text/plain",
        filename: "attachment.txt",
        url: "data:text/plain;base64,aGVsbG8=",
      },
    ]);
  });

  test("incrementally reduces live events without replacing unchanged messages", () => {
    const restoredEvents: AgentSessionEvent[] = [
      { ...base, id: "evt_1", type: "run.started" },
      { ...base, id: "evt_2", type: "user.message", messageId: "user_1", text: "hello" },
      {
        ...base,
        id: "evt_3",
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "old reply",
        blocks: [{ kind: "text", text: "old reply", createdAt: base.createdAt }],
      },
      { ...base, id: "evt_4", type: "run.completed" },
      { ...base, id: "evt_5", type: "run.started", runId: "run_2" },
    ];
    const liveEvent: AgentEvent = {
      ...base,
      id: "evt_6",
      type: "assistant.text.delta",
      runId: "run_2",
      messageId: "assistant_2",
      delta: "new reply",
    };
    const restored = restoredEvents.reduce(reduceAgentSessionEvent, initialAgentSessionState);
    const firstMessage = restored.messages[0];

    const next = reduceAgentSessionEvent(restored, liveEvent);

    expect(next).toEqual(reduceAgentSession([...restoredEvents, liveEvent]));
    expect(next.messages[0]).toBe(firstMessage);
  });
});
