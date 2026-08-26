import { describe, expect, test } from "vitest";
import {
  activityElapsedLabel,
  activityGroupPresentation,
  activityStartedAt,
  completedGroupSummary,
  elapsedBetween,
  reasoningSummary,
  toolIconKind,
  type AgentToolIconKind,
} from "./activity-presentation";
import type { AgentActivityBlockView, AgentToolActivityView } from "./types";

function toolActivity(
  toolName: string,
  status: AgentToolActivityView["status"] = "done",
): AgentToolActivityView {
  return {
    id: `tool-${toolName}`,
    toolName,
    status,
    summary: `执行 ${toolName}`,
    items: [],
  };
}

describe("agent activity presentation", () => {
  test("uses model reasoning as the completed thinking summary", () => {
    expect(
      reasoningSummary("## 分析\n\n先读取 **Journal**，再核对[相关理解](https://example.com)。"),
    ).toBe("分析 先读取 Journal，再核对相关理解。");
  });

  test("shows a running-state label while the group is working", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "reasoning",
        reasoning: { id: "reasoning-1", status: "done", markdown: "先检查已有内容" },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("read", "failed"),
          summary: "读取「journal.md」失败",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("retrieve_knowledge", "running"),
          summary: "正在检索「Agent UX」",
        },
      },
    ];

    expect(activityGroupPresentation(blocks)).toMatchObject({
      summary: "执行工具中",
      stepCount: 3,
      errorCount: 1,
      running: true,
    });
  });

  test("summarizes a completed group with semantic action phrases", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "reasoning",
        reasoning: { id: "reasoning-1", status: "done", markdown: "已经确认实现边界" },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("attachment_read"),
          summary: "读取了附件「复盘.pdf」",
        },
      },
    ];

    expect(activityGroupPresentation(blocks).summary).toBe("读取了附件「复盘.pdf」，完成思考");
    expect(completedGroupSummary(blocks, "3.2s")).toBe("读取了附件「复盘.pdf」，思考了 3.2s");
  });

  test("groups activities into semantic buckets in product order", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "reasoning",
        reasoning: { id: "reasoning-1", status: "done", markdown: "梳理已有理解" },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("understanding_get"),
          summary: "读取了「反馈回路」",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("understanding_get"),
          summary: "读取了「习惯养成」",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("understanding_list"),
          summary: "列出「交易心理」下的 Understanding · 2 条",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("retrieve_knowledge"),
          summary: "检索到 1 条 Understanding 证据",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("image_generate"),
          summary: "已生成图片",
        },
      },
    ];

    expect(completedGroupSummary(blocks, "3.2s")).toBe(
      "查看了「反馈回路」「习惯养成」等 3 条知识，检索了 1 次你的知识，生成了 1 张图片，思考了 3.2s",
    );
  });

  test("falls back to counts when activities carry no object name", () => {
    const activity = (toolName: string) => ({
      kind: "tool-activity" as const,
      activity: toolActivity(toolName),
    });
    expect(completedGroupSummary([activity("attachment_read")])).toBe("读取了 1 个附件");
    expect(completedGroupSummary([activity("understanding_get")])).toBe("查看了 1 条知识");
    expect(completedGroupSummary([activity("bash")])).toBe("运行了 1 条命令");
    expect(completedGroupSummary([])).toBe("已完成");
  });

  test("truncates long object names in the collapsed summary", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("attachment_read"),
          summary: "读取了附件「abcdefghijklmnopqrstuvwxyz.pdf」",
        },
      },
    ];
    expect(completedGroupSummary(blocks)).toBe("读取了附件「abcdefghijklmnopq…」");
  });

  test("sums every thinking segment from session timestamps", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "reasoning",
        reasoning: {
          id: "r1",
          status: "done",
          markdown: "先读策略",
          createdAt: "2026-06-23T00:00:00.000Z",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("understanding_get"),
          createdAt: "2026-06-23T00:00:02.000Z",
        },
      },
      {
        kind: "reasoning",
        reasoning: {
          id: "r2",
          status: "done",
          markdown: "再核对遥测",
          createdAt: "2026-06-23T00:00:05.000Z",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("attachment_read"),
          createdAt: "2026-06-23T00:00:08.500Z",
        },
      },
    ];

    expect(activityElapsedLabel(blocks)).toBe("5.5s");
    expect(activityGroupPresentation(blocks).summary).toBe(
      "读取了 1 个附件，查看了 1 条知识，思考了 5.5s",
    );
  });

  test("uses the earliest block timestamp as the group start", () => {
    expect(
      activityStartedAt([
        {
          kind: "reasoning",
          reasoning: {
            id: "r1",
            status: "streaming",
            markdown: "先读策略",
            createdAt: "2026-06-23T00:00:00.000Z",
          },
        },
        {
          kind: "tool-activity",
          activity: {
            ...toolActivity("read", "running"),
            createdAt: "2026-06-23T00:00:02.000Z",
          },
        },
      ]),
    ).toBe("2026-06-23T00:00:00.000Z");
    expect(
      activityStartedAt([{ kind: "tool-activity", activity: toolActivity("read") }]),
    ).toBeNull();
  });

  test("formats a single thinking span between two timestamps", () => {
    expect(elapsedBetween("2026-06-23T00:00:00.000Z", "2026-06-23T00:00:03.200Z")).toBe("3.2s");
    expect(elapsedBetween("2026-06-23T00:00:00.000Z", "2026-06-23T00:00:00.040Z")).toBeNull();
    expect(elapsedBetween(undefined, "2026-06-23T00:00:03.200Z")).toBeNull();
  });

  test("uses the following text timestamp to close a trailing thinking segment", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "reasoning",
        reasoning: {
          id: "r1",
          status: "done",
          markdown: "整理结论",
          createdAt: "2026-06-23T00:00:10.000Z",
        },
      },
    ];

    expect(activityElapsedLabel(blocks, "2026-06-23T00:00:11.400Z")).toBe("1.4s");
  });

  test("keeps the tail activity running while the agent still owns the turn", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "tool-activity",
        activity: toolActivity("read", "done"),
      },
    ];

    expect(activityGroupPresentation(blocks, true).running).toBe(true);
  });

  test("shows a thinking label while reasoning streams", () => {
    expect(
      activityGroupPresentation([
        {
          kind: "reasoning",
          reasoning: {
            id: "reasoning-streaming",
            status: "streaming",
            markdown: "先浏览知识库，再筛选值得展开的笔记",
          },
        },
      ]).summary,
    ).toBe("思考中");
  });

  test.each<[readonly string[], AgentToolIconKind]>([
    [["canvas_list", "canvas_read", "canvas_search", "canvas_present"], "canvas"],
    [["domain_list", "domain_inspect"], "domain"],
    [["understanding_list", "understanding_get"], "understanding"],
    [["context_list", "context_get"], "context"],
    [["attachment_read"], "attachment"],
    [["retrieve_knowledge"], "search"],
    [["web_search", "source_check"], "web"],
    [["read", "fetch_content", "get_search_content"], "file"],
    [["edit"], "edit"],
    [["write"], "write"],
    [["bash"], "command"],
    [["image_generate"], "other"],
  ])("assigns %s tools to the %s icon", (toolNames, icon) => {
    for (const toolName of toolNames) {
      expect(toolIconKind(toolActivity(toolName))).toBe(icon);
    }
  });
});
