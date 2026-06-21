import { describe, expect, test } from "vitest";
import type { AgentChatMessage } from "@shared/chat";
import { buildAgentTurnView, type AgentToolPart } from "./agent-turn-view";

function text(text: string): AgentChatMessage["parts"][number] {
  return { type: "text", text };
}

function reasoning(
  text: string,
  state: "streaming" | "done" = "done",
): AgentChatMessage["parts"][number] {
  return { type: "reasoning", text, state };
}

function tool(
  name: string,
  toolCallId: string,
  output: unknown,
  state: AgentToolPart["state"] = "output-available",
  errorText?: string,
): AgentToolPart {
  return {
    type: `tool-${name}`,
    toolCallId,
    state,
    input: {},
    output,
    ...(errorText ? { errorText } : {}),
  } as AgentToolPart;
}

function proposalTool(
  name: string,
  toolCallId: string,
  input: Record<string, unknown>,
  state: AgentToolPart["state"] = "approval-requested",
): AgentToolPart {
  return {
    type: `tool-${name}`,
    toolCallId,
    state,
    input,
    toolMetadata: { kind: "proposal", proposalType: name },
    approval: { id: `approval-${toolCallId}`, approved: state === "approval-responded" },
  } as AgentToolPart;
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

  test("keeps streaming reasoning content visible", () => {
    const turn = buildAgentTurnView([reasoning("正在比较已有笔记", "streaming")]);

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
    const runningTurn = buildAgentTurnView([tool("search_all", "tool-1", {}, "input-streaming")]);
    const failedTurn = buildAgentTurnView([
      tool("graph_path", "tool-2", {}, "output-error", "Graph query failed"),
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
    ["thought_create", "候选 Thought", "thought"],
    ["thought_update", "候选修改", "thought-update"],
    ["thought_delete", "候选删除 Thought", "generic"],
    ["category_create", "候选 Category", "generic"],
    ["category_update", "候选修改 Category", "generic"],
    ["category_delete", "候选删除 Category", "generic"],
    ["context_create", "候选 Context", "context"],
    ["context_update", "候选修改 Context", "generic"],
    ["context_delete", "候选删除 Context", "generic"],
  ])("maps %s proposal view metadata", (proposalType, title, renderKind) => {
    const turn = buildAgentTurnView([
      proposalTool(proposalType, "tool-1", {
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

  test("does not treat old proposal tool names as proposal cards", () => {
    const turn = buildAgentTurnView([
      tool("thought_create_proposal", "tool-1", {
        body: "new thought",
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        groupType: "lookup",
      },
    });
  });
});
