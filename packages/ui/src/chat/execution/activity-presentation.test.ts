import { describe, expect, test } from "vitest";
import {
  activityGroupPresentation,
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

  test("summarizes a group with its latest step, total steps, errors and running state", () => {
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

    expect(activityGroupPresentation(blocks)).toEqual({
      summary: "正在检索「Agent UX」",
      stepCount: 3,
      errorCount: 1,
      running: true,
    });
  });

  test("uses the last thinking block as the completed group summary", () => {
    const blocks: AgentActivityBlockView[] = [
      {
        kind: "reasoning",
        reasoning: { id: "reasoning-1", status: "done", markdown: "已经确认实现边界" },
      },
      {
        kind: "tool-activity",
        activity: {
          ...toolActivity("read"),
          summary: "读取了「chat-message-row.tsx」",
        },
      },
    ];

    expect(activityGroupPresentation(blocks).summary).toBe("已经确认实现边界");
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

  test("shows partial reasoning in the activity summary while it streams", () => {
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
    ).toBe("先浏览知识库，再筛选值得展开的笔记");
  });

  test.each<[readonly string[], AgentToolIconKind]>([
    [["read", "file_read", "fetch_content", "get_search_content"], "file"],
    [["edit"], "edit"],
    [["write"], "write"],
    [["bash"], "command"],
    [["attachment_read"], "attachment"],
    [["domain_list", "domain_inspect"], "domain"],
    [["understanding_list", "understanding_get"], "understanding"],
    [["context_list", "context_get"], "context"],
    [["retrieve_knowledge", "search"], "search"],
    [["graph"], "graph"],
    [["web_search"], "web"],
  ])("assigns %s tools to the %s icon", (toolNames, icon) => {
    for (const toolName of toolNames) {
      expect(toolIconKind(toolActivity(toolName))).toBe(icon);
    }
  });
});
