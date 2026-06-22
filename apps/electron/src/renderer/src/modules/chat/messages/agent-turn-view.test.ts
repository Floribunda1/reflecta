import { describe, expect, test } from "vitest";
import type { AgentReducedAssistantBlock } from "@shared/agent";
import { buildAgentTurnView } from "./agent-turn-view";

function text(text: string): AgentReducedAssistantBlock {
  return { kind: "text", text, createdAt: "2026-06-23T00:00:00.000Z" };
}

function reasoning(text: string): AgentReducedAssistantBlock {
  return { kind: "reasoning", text, createdAt: "2026-06-23T00:00:00.000Z" };
}

function tool(
  name: string,
  toolCallId: string,
  output: unknown,
  state: "running" | "completed" | "failed" = "completed",
  error?: string,
): AgentReducedAssistantBlock {
  return {
    kind: "tool",
    toolCallId,
    toolName: name,
    state,
    input: {},
    output,
    error,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}

function proposal(
  name: string,
  toolCallId: string,
  payload: Record<string, unknown>,
  state: "pending" | "approved" | "rejected" | "completed" | "failed" = "pending",
): AgentReducedAssistantBlock {
  return {
    kind: "approval",
    approvalId: `approval-${toolCallId}`,
    toolCallId,
    toolName: name,
    title: name,
    payload,
    approved: state === "approved" || state === "completed",
    state,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}

describe("buildAgentTurnView", () => {
  test("preserves interleaved tool and text order", () => {
    const turn = buildAgentTurnView([
      tool("search_all", "tool-1", { thoughts: [{ id: "t1" }], contexts: [] }),
      reasoning("我先看相关内容"),
      text("first"),
      tool("graph_neighborhood", "tool-2", { nodes: [{ id: "t2" }] }),
      text("second"),
    ]);

    expect(turn.blocks.map((block) => block.kind)).toEqual([
      "tool-activity",
      "reasoning",
      "text",
      "tool-activity",
      "text",
    ]);
    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "lookup" },
    });
    expect(turn.blocks[1]).toMatchObject({
      kind: "reasoning",
      reasoning: { text: "我先看相关内容", status: "done" },
    });
    expect(turn.blocks[3]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "graph" },
    });
  });

  test("keeps running reasoning content visible", () => {
    const turn = buildAgentTurnView([reasoning("正在比较已有笔记")], true);

    expect(turn.blocks).toEqual([
      {
        kind: "reasoning",
        reasoning: { text: "正在比较已有笔记", status: "streaming" },
      },
    ]);
  });

  test("groups adjacent lookup tools without crossing text", () => {
    const turn = buildAgentTurnView([
      tool("search_all", "tool-1", { thoughts: [{ id: "t1" }], contexts: [] }),
      tool("thought_get", "tool-2", { thought: { id: "t1", title: "A" } }),
      text("answer"),
      tool("context_list", "tool-3", { contexts: [{ id: "c1" }] }),
    ]);

    expect(turn.blocks).toHaveLength(3);
    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        groupType: "lookup",
        items: expect.arrayContaining([expect.objectContaining({ label: "读取了「A」" })]),
      },
    });
    expect(turn.blocks[2]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "lookup" },
    });
  });

  test("summarizes lookup activity", () => {
    const turn = buildAgentTurnView([
      tool("search_all", "tool-1", {
        thoughts: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
        contexts: [{ id: "c1" }],
      }),
      tool("thought_get", "tool-2", { thought: { id: "t1", title: "拖延与自我保护" } }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "查找相关内容",
        status: "done",
        summary: "搜索 3 条 Thought，读取 1 条 Context",
        items: expect.arrayContaining([
          expect.objectContaining({
            label: "搜索了 3 条 Thought / 1 条 Context",
            status: "done",
          }),
          expect.objectContaining({
            label: "读取了「拖延与自我保护」",
            status: "done",
          }),
        ]),
      },
    });
  });

  test("summarizes list tools from array outputs", () => {
    const turn = buildAgentTurnView([tool("thought_list", "tool-1", [{ id: "t1" }, { id: "t2" }])]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "列出 Thought",
        summary: "列出 2 条 Thought",
        items: [
          expect.objectContaining({
            label: "列出 2 条 Thought",
            status: "done",
          }),
        ],
      },
    });
  });

  test("keeps running and failed tool activity states in thinking", () => {
    const runningTurn = buildAgentTurnView([tool("search_all", "tool-1", {}, "running")]);
    const failedTurn = buildAgentTurnView([
      tool("graph_path", "tool-2", {}, "failed", "Graph query failed"),
    ]);

    expect(runningTurn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        status: "running",
        statusLabel: "运行中",
        items: [expect.objectContaining({ status: "running", statusLabel: "运行中" })],
      },
    });
    expect(failedTurn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        status: "failed",
        statusLabel: "出错",
        summary: "查看关联失败",
        items: [
          expect.objectContaining({
            status: "failed",
            statusLabel: "出错",
            label: "查看关联失败",
            errorText: "Graph query failed",
          }),
        ],
      },
    });
  });

  test.each([
    ["thought_create", "thought_create", "thought"],
    ["thought_update", "thought_update", "thought-update"],
    ["thought_delete", "thought_delete", "generic"],
    ["category_create", "category_create", "generic"],
    ["category_update", "category_update", "generic"],
    ["category_delete", "category_delete", "generic"],
    ["context_create", "context_create", "context"],
    ["context_update", "context_update", "generic"],
    ["context_delete", "context_delete", "generic"],
  ])("maps %s proposal view metadata", (proposalType, title, renderKind) => {
    const turn = buildAgentTurnView([
      proposal(proposalType, "tool-1", {
        body: "new thought",
        content: "new context",
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        type: proposalType,
        title,
        status: "pending",
        data: { kind: renderKind },
      },
    });
  });

  test("keeps direct completion distinct from user approval", () => {
    const turn = buildAgentTurnView([
      {
        kind: "approval",
        approvalId: "approval-tool-1",
        toolCallId: "tool-1",
        toolName: "thought_create",
        title: "候选 Thought",
        payload: { title: "A", body: "B" },
        output: { resultRefType: "thought", resultRefId: "thought_1" },
        state: "completed",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        status: undefined,
        state: "output-available",
      },
    });
  });
});
