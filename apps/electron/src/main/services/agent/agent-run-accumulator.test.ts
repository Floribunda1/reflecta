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
        output: { resultRefId: "understanding_1" },
      },
      { kind: "text", text: "完成。" },
    ]);
  });
});
