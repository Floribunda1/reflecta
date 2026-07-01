import { describe, expect, test } from "vitest";
import { AgentRunAccumulator } from "./agent-run-accumulator";

const base = {
  id: "evt_1",
  sessionId: "session_1",
  runId: "run_1",
  messageId: "assistant_1",
  createdAt: "2026-06-23T00:00:00.000Z",
};

describe("AgentRunAccumulator", () => {
  test("folds live stream events into one assistant turn", () => {
    const accumulator = new AgentRunAccumulator();

    accumulator.append({ ...base, id: "evt_1", type: "assistant.reasoning.delta", delta: "先看" });
    accumulator.append({
      ...base,
      id: "evt_2",
      type: "assistant.reasoning.delta",
      delta: "资料",
    });
    accumulator.append({
      ...base,
      id: "evt_3",
      type: "tool.started",
      toolCallId: "tool_1",
      toolName: "search",
      input: { query: "feedback" },
    });
    accumulator.append({
      ...base,
      id: "evt_4",
      type: "tool.completed",
      toolCallId: "tool_1",
      toolName: "search",
      output: { hits: [{ id: "context_1" }] },
    });
    accumulator.append({
      ...base,
      id: "evt_5",
      type: "approval.requested",
      approvalId: "approval_tool_2",
      toolCallId: "tool_2",
      toolName: "understanding_create",
      title: "候选 Understanding",
      payload: { title: "A" },
    });
    accumulator.append({
      ...base,
      id: "evt_6",
      type: "approval.resolved",
      approvalId: "approval_tool_2",
      toolCallId: "tool_2",
      toolName: "understanding_create",
      approved: true,
    });
    accumulator.append({
      ...base,
      id: "evt_7",
      type: "tool.completed",
      toolCallId: "tool_2",
      toolName: "understanding_create",
      output: { resultRefId: "understanding_1" },
    });
    accumulator.append({ ...base, id: "evt_8", type: "assistant.text.delta", delta: "完成" });
    accumulator.append({ ...base, id: "evt_9", type: "assistant.text.delta", delta: "。" });

    const turn = accumulator.toAssistantTurn({
      ...base,
      id: "evt_turn",
      type: "assistant.turn",
    });

    expect(turn.text).toBe("完成。");
    expect(turn.blocks).toMatchObject([
      { kind: "reasoning", text: "先看资料" },
      {
        kind: "tool",
        toolCallId: "tool_1",
        state: "completed",
        output: { hits: [{ id: "context_1" }] },
      },
      {
        kind: "approval",
        approvalId: "approval_tool_2",
        state: "completed",
        approved: true,
        approvalState: "approved",
        executionState: "completed",
        displayState: "completed",
        output: { resultRefId: "understanding_1" },
      },
      { kind: "text", text: "完成。" },
    ]);
  });

  test("converts internal final answer output into a text block with parts", () => {
    const accumulator = new AgentRunAccumulator();

    accumulator.appendFinalAnswer({
      ...base,
      parts: [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
        { type: "text", text: "下面。" },
      ],
      text: "放在三观下面。",
    });

    expect(
      accumulator.toAssistantTurn({
        ...base,
        id: "turn_1",
        type: "assistant.turn",
      }).blocks,
    ).toEqual([
      {
        kind: "text",
        text: "放在三观下面。",
        parts: [
          { type: "text", text: "放在" },
          { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
          { type: "text", text: "下面。" },
        ],
        state: "done",
        createdAt: base.createdAt,
      },
    ]);
  });

  test("keeps streaming final output partials in the active run snapshot", () => {
    const accumulator = new AgentRunAccumulator();

    accumulator.append({
      ...base,
      id: "evt_final_partial",
      type: "assistant.final.partial",
      text: "放在三观下面，继续",
      parts: [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
        { type: "text", text: "下面" },
      ],
      previewText: "，继续",
    });

    expect(
      accumulator.toAssistantTurn({
        ...base,
        id: "turn_1",
        type: "assistant.turn",
      }).blocks,
    ).toEqual([
      {
        kind: "text",
        text: "放在三观下面，继续",
        parts: [
          { type: "text", text: "放在" },
          { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
          { type: "text", text: "下面" },
        ],
        previewText: "，继续",
        state: "streaming",
        createdAt: base.createdAt,
      },
    ]);
  });

  test("persists final answer failure in the active run snapshot", () => {
    const accumulator = new AgentRunAccumulator();

    accumulator.append({
      ...base,
      id: "evt_final_failed",
      type: "assistant.final.failed",
      error: "引用实体不存在: domain/missing",
    });

    expect(
      accumulator.toAssistantTurn({
        ...base,
        id: "turn_1",
        type: "assistant.turn",
      }).blocks,
    ).toEqual([
      {
        kind: "text",
        text: "",
        state: "failed",
        error: "引用实体不存在: domain/missing",
        createdAt: base.createdAt,
      },
    ]);
  });

  test("shows execution failure even if approval is still pending", () => {
    const accumulator = new AgentRunAccumulator();

    accumulator.append({
      ...base,
      id: "evt_1",
      type: "approval.requested",
      approvalId: "approval_tool_1",
      toolCallId: "tool_1",
      toolName: "domain_update",
      title: "候选修改 Domain",
      payload: { domainId: "domain_1", name: "新名字" },
    });
    accumulator.append({
      ...base,
      id: "evt_2",
      type: "tool.failed",
      toolCallId: "tool_1",
      toolName: "domain_update",
      error: "Domain not found: domain_1",
    });

    expect(
      accumulator.toAssistantTurn({
        ...base,
        id: "turn_1",
        type: "assistant.turn",
      }).blocks[0],
    ).toMatchObject({
      kind: "approval",
      approvalState: "pending",
      executionState: "failed",
      displayState: "failed",
      state: "failed",
      error: "Domain not found: domain_1",
    });
  });

  test("collects completed tool outputs for finalization", () => {
    const accumulator = new AgentRunAccumulator();

    accumulator.append({
      ...base,
      id: "evt_tool_started",
      type: "tool.started",
      toolCallId: "tool_1",
      toolName: "domain_inspect",
      input: { domainId: "domain_1" },
    });
    accumulator.append({
      ...base,
      id: "evt_tool_completed",
      type: "tool.completed",
      toolCallId: "tool_1",
      toolName: "domain_inspect",
      output: { domain: { id: "domain_1" } },
    });
    accumulator.append({
      ...base,
      id: "evt_tool_failed",
      type: "tool.failed",
      toolCallId: "tool_2",
      toolName: "context_inspect",
      error: "not found",
    });

    expect(accumulator.toolResults()).toEqual([{ domain: { id: "domain_1" } }]);
  });
});
