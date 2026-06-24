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
  input: unknown = {},
): AgentReducedAssistantBlock {
  return {
    kind: "tool",
    toolCallId,
    toolName: name,
    state,
    input,
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
      tool("search", "tool-1", { hits: [{ type: "understanding", understanding: { id: "t1" } }] }),
      reasoning("我先看相关内容"),
      text("first"),
      tool("bash", "tool-2", { exitCode: 0 }),
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
      activity: { groupType: "other" },
    });
  });

  test("keeps running reasoning content visible", () => {
    const turn = buildAgentTurnView([reasoning("正在比较已有理解")], true);

    expect(turn.blocks).toEqual([
      {
        kind: "reasoning",
        reasoning: { text: "正在比较已有理解", status: "streaming" },
      },
    ]);
  });

  test("marks reasoning done once later tool or text content exists", () => {
    const turn = buildAgentTurnView(
      [
        reasoning("先查找相关内容"),
        tool("search", "tool-1", {
          hits: [{ type: "understanding", understanding: { id: "t1" } }],
        }),
        reasoning("再确认详情"),
        tool("understanding_get", "tool-2", {
          understanding: { id: "t1", title: "Feedback Loop" },
        }),
        text("最终答案开始输出。"),
      ],
      true,
    );

    expect(turn.blocks).toMatchObject([
      { kind: "reasoning", reasoning: { text: "先查找相关内容", status: "done" } },
      { kind: "tool-activity" },
      { kind: "reasoning", reasoning: { text: "再确认详情", status: "done" } },
      { kind: "tool-activity" },
      { kind: "text", text: "最终答案开始输出。" },
    ]);
  });

  test("renders each adjacent tool as its own activity without crossing text", () => {
    const turn = buildAgentTurnView([
      tool("search", "tool-1", {
        hits: [{ type: "understanding", understanding: { id: "t1" } }],
      }),
      tool("understanding_get", "tool-2", { understanding: { id: "t1", title: "A" } }),
      text("answer"),
      tool("context_list", "tool-3", { contexts: [{ id: "c1" }] }),
    ]);

    expect(turn.blocks).toHaveLength(4);
    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "lookup", items: [expect.objectContaining({ toolName: "search" })] },
    });
    expect(turn.blocks[1]).toMatchObject({
      kind: "tool-activity",
      activity: {
        groupType: "lookup",
        items: [expect.objectContaining({ label: "读取了「A」" })],
      },
    });
    expect(turn.blocks[3]).toMatchObject({
      kind: "tool-activity",
      activity: { groupType: "lookup" },
    });
  });

  test("shows search query and result details in its own tool activity", () => {
    const turn = buildAgentTurnView([
      tool(
        "search",
        "tool-1",
        {
          hits: [
            {
              type: "understanding",
              understanding: { id: "t1", title: "拖延与自我保护" },
              matchedText: "拖延有时是在保护自己",
            },
            { type: "context", context: { id: "c1", title: "复盘片段" }, understandingId: "t1" },
          ],
        },
        "completed",
        undefined,
        { query: "拖延", limit: 5 },
      ),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "搜索相关内容",
        status: "done",
        summary: "搜索「拖延」 · 1 条 Understanding / 1 条 Context",
        items: [
          expect.objectContaining({
            label: "搜索「拖延」 · 1 条 Understanding / 1 条 Context",
            status: "done",
            details: [
              "查询：拖延",
              "limit：5",
              "Understanding：拖延与自我保护 · 拖延有时是在保护自己",
              "Context：复盘片段",
            ],
          }),
        ],
      },
    });
  });

  test("shows web fetch URL and result details", () => {
    const turn = buildAgentTurnView([
      tool(
        "web_fetch",
        "tool-1",
        {
          url: "https://martinfowler.com/eaaDev/uiArchs.html",
          finalUrl: "https://martinfowler.com/eaaDev/uiArchs.html",
          title: "GUI Architectures",
          markdown: "# GUI Architectures\nPresentation Model",
          provider: "curl.md",
          truncated: true,
        },
        "completed",
        undefined,
        { url: "https://martinfowler.com/eaaDev/uiArchs.html" },
      ),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        groupType: "lookup",
        title: "读取网页",
        status: "done",
        summary: "读取了网页「GUI Architectures」",
        items: [
          expect.objectContaining({
            label: "读取了网页「GUI Architectures」",
            details: [
              "url：https://martinfowler.com/eaaDev/uiArchs.html",
              "标题：GUI Architectures",
              "内容：38 字",
              "内容已截断",
            ],
          }),
        ],
      },
    });
  });

  test("shows blocked web fetch as unreadable", () => {
    const turn = buildAgentTurnView([
      tool(
        "web_fetch",
        "tool-1",
        {
          url: "https://www.zhihu.com/question/1",
          markdown: "安全验证 - 知乎",
          provider: "curl.md",
          truncated: false,
          blocked: true,
          error: "Page appears blocked or login-gated.",
        },
        "completed",
        undefined,
        { url: "https://www.zhihu.com/question/1" },
      ),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "读取网页",
        summary: "网页无法读取「https://www.zhihu.com/question/1」",
        items: [
          expect.objectContaining({
            details: [
              "url：https://www.zhihu.com/question/1",
              "状态：无法读取",
              "内容：9 字",
              "错误：Page appears blocked or login-gated.",
            ],
          }),
        ],
      },
    });
  });

  test("summarizes list tools from array outputs", () => {
    const turn = buildAgentTurnView([
      tool("understanding_list", "tool-1", [{ id: "t1" }, { id: "t2" }]),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "列出 Understanding",
        summary: "列出 2 条 Understanding",
        items: [
          expect.objectContaining({
            label: "列出 2 条 Understanding",
            status: "done",
          }),
        ],
      },
    });
  });

  test("summarizes mixed search hits", () => {
    const turn = buildAgentTurnView([
      tool("search", "tool-1", {
        hits: [
          { type: "understanding", understanding: { id: "t1" } },
          { type: "context", context: { id: "c1" }, understandingId: "t1" },
        ],
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "搜索相关内容",
        summary: "搜索了 1 条 Understanding / 1 条 Context",
        items: [
          expect.objectContaining({
            label: "搜索了 1 条 Understanding / 1 条 Context",
            status: "done",
          }),
        ],
      },
    });
  });

  test("summarizes graph tool output", () => {
    const turn = buildAgentTurnView([
      tool("graph", "tool-1", {
        nodes: [{ id: "t1" }, { id: "t2" }],
        edges: [{ from: "t1", to: "t2" }],
      }),
    ]);

    expect(turn.blocks[0]).toMatchObject({
      kind: "tool-activity",
      activity: {
        title: "查看关联图",
        summary: "查看了 2 条 Understanding 的关联图",
      },
    });
  });

  test("keeps running and failed tool activity states in thinking", () => {
    const runningTurn = buildAgentTurnView([tool("search", "tool-1", {}, "running")]);
    const failedTurn = buildAgentTurnView([tool("bash", "tool-2", {}, "failed", "Command failed")]);

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
        summary: "执行 Bash失败",
        items: [
          expect.objectContaining({
            status: "failed",
            statusLabel: "出错",
            label: "执行 Bash失败",
            errorText: "Command failed",
          }),
        ],
      },
    });
  });

  test.each([
    ["understanding_create", "understanding_create", "understanding"],
    ["understanding_update", "understanding_update", "understanding-update"],
    ["understanding_delete", "understanding_delete", "generic"],
    ["domain_create", "domain_create", "generic"],
    ["domain_update", "domain_update", "generic"],
    ["domain_delete", "domain_delete", "generic"],
    ["context_create", "context_create", "context"],
    ["context_update", "context_update", "generic"],
    ["context_delete", "context_delete", "generic"],
  ])("maps %s proposal view metadata", (proposalType, title, renderKind) => {
    const turn = buildAgentTurnView([
      proposal(proposalType, "tool-1", {
        body: "new understanding",
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
        toolName: "understanding_create",
        title: "候选 Understanding",
        payload: { title: "A", body: "B" },
        output: { resultRefType: "understanding", resultRefId: "understanding_1" },
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
