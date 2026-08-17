import { describe, expect, test } from "vitest";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import {
  computeRecapStats,
  HEATMAP_DAYS_PER_WEEK,
  HEATMAP_WEEKS,
  STATE_LIST_LIMIT,
  type RecapInput,
} from "./stats";

function understanding(
  partial: Partial<UnderstandingSummaryDTO> & { id: string },
): UnderstandingSummaryDTO {
  return {
    title: null,
    body: "",
    domainIds: [],
    contextCount: 0,
    mentionCount: 0,
    mentionIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function canvas(partial: Partial<CanvasDTO> & { id: string }): CanvasDTO {
  return {
    title: "画布",
    description: null,
    viewport: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function input(
  overrides: { understandings?: unknown[]; canvases?: unknown[]; recap?: Partial<RecapData> } = {},
): RecapInput {
  const recap: RecapData = {
    sessions: [],
    contextCreates: [],
    canvasElementCreates: [],
    canvasEdgeCreates: [],
    canvasReferencedUnderstandingIds: [],
    ...overrides.recap,
  };
  return {
    understandings: (overrides.understandings ?? []) as RecapInput["understandings"],
    canvases: (overrides.canvases ?? []) as RecapInput["canvases"],
    recap,
  };
}

function session(partial: Partial<RecapData["sessions"][number]> = {}) {
  return {
    sessionId: "s1",
    title: "对话",
    createdAt: "2026-06-18T08:00:00.000Z",
    updatedAt: "2026-06-18T09:00:00.000Z",
    messageCount: 1,
    userMessageDates: ["2026-06-18T08:00:00.000Z"],
    ...partial,
  };
}

// 固定「今天」：2026-06-18（周四），保证热力图/周界可复现
const NOW = new Date("2026-06-18T12:00:00.000Z");

describe("computeRecapStats", () => {
  test("空输入：全部归零，热力图铺满 12 周空白格", () => {
    const stats = computeRecapStats(input(), NOW);

    expect(stats.today).toEqual({ conversations: 0, messages: 0, actions: 0 });
    expect(stats.assets).toEqual({
      understandingTotal: 0,
      canvasTotal: 0,
      contextTotal: 0,
    });
    expect(stats.heatmapWeeks).toHaveLength(HEATMAP_WEEKS);
    for (const week of stats.heatmapWeeks) {
      expect(week).toHaveLength(HEATMAP_DAYS_PER_WEEK);
      for (const cell of week) {
        expect(cell.level).toBe(0);
      }
    }
  });

  test("今日实时层：统计今天的对话/消息数与沉淀动作", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          understanding({ id: "today-create", createdAt: "2026-06-18T08:00:00.000Z" }),
          understanding({
            id: "today-edit",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-18T10:00:00.000Z",
          }),
          understanding({ id: "old", createdAt: "2026-06-01T00:00:00.000Z" }),
        ],
        canvases: [canvas({ id: "c1", createdAt: "2026-06-18T09:00:00.000Z" })],
        recap: {
          sessions: [
            session({
              sessionId: "today",
              userMessageDates: ["2026-06-18T08:00:00.000Z", "2026-06-18T09:00:00.000Z"],
            }),
            session({
              sessionId: "old",
              createdAt: "2026-06-01T00:00:00.000Z",
              updatedAt: "2026-06-01T00:00:00.000Z",
              userMessageDates: ["2026-06-01T00:00:00.000Z"],
            }),
          ],
          contextCreates: ["2026-06-18T07:00:00.000Z", "2026-06-01T00:00:00.000Z"],
          canvasElementCreates: ["2026-06-18T09:30:00.000Z"],
          canvasEdgeCreates: [],
        },
      }),
      NOW,
    );

    expect(stats.today.conversations).toBe(1); // 只有今天有消息的会话
    expect(stats.today.messages).toBe(2);
    // 今天动作 = 创建 1 + 编辑 1 + 画布创建 1 + 上下文 1 + 元素 1
    expect(stats.today.actions).toBe(5);
  });

  test("热力图：列=周（旧→新）、行=周一→周日、参与事件计入对应日期", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          understanding({ id: "a", createdAt: "2026-06-15T08:00:00.000Z" }),
          understanding({ id: "b", createdAt: "2026-06-14T08:00:00.000Z" }),
        ],
        recap: {
          sessions: [session({ sessionId: "s", createdAt: "2026-06-15T09:00:00.000Z" })],
          contextCreates: ["2026-06-15T10:00:00.000Z"],
        },
      }),
      NOW,
    );

    // 2026-06-18 是周四，本周一 = 06-15
    const thisWeek = stats.heatmapWeeks.at(-1)!;
    expect(thisWeek[0]?.date).toBe("2026-06-15");
    // 06-15：理解创建 + 会话 + 上下文 = 3 次参与 → 档位 2
    expect(thisWeek[0]?.count).toBe(3);
    expect(thisWeek[0]?.level).toBe(2);
    expect(thisWeek[4]?.date).toBeNull(); // 周五（06-19）是未来 → 空白格
  });

  test("热力图：12 周起点是 11 周前的周一", () => {
    const stats = computeRecapStats(input(), NOW);
    const firstWeek = stats.heatmapWeeks[0]!;
    expect(firstWeek[0]?.date).toBe("2026-03-30");
  });

  test("资产分列计数：理解/画布/上下文各自统计", () => {
    const stats = computeRecapStats(
      input({
        understandings: [understanding({ id: "a" }), understanding({ id: "b" })],
        canvases: [canvas({ id: "c1" })],
        recap: {
          contextCreates: [
            "2026-06-01T00:00:00.000Z",
            "2026-06-02T00:00:00.000Z",
            "2026-06-03T00:00:00.000Z",
          ],
        },
      }),
      NOW,
    );

    expect(stats.assets.understandingTotal).toBe(2);
    expect(stats.assets.canvasTotal).toBe(1);
    expect(stats.assets.contextTotal).toBe(3);
  });

  test("结构状态 · 孤岛：出现在任意画布的理解被排除", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          understanding({ id: "island", title: "孤岛理解", createdAt: "2026-06-01T00:00:00.000Z" }),
          understanding({ id: "linked", title: "已入画布", createdAt: "2026-06-02T00:00:00.000Z" }),
        ],
        recap: { canvasReferencedUnderstandingIds: ["linked"] },
      }),
      NOW,
    );

    expect(stats.states.islands.map((item) => item.id)).toEqual(["island"]);
    expect(stats.states.islandTotal).toBe(1);
  });

  test("结构状态 · 缺上下文：contextCount 为 0 的理解", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          understanding({ id: "no-ctx", title: "无根理解", contextCount: 0 }),
          understanding({ id: "has-ctx", title: "有根理解", contextCount: 3 }),
        ],
      }),
      NOW,
    );

    expect(stats.states.missingContext.map((item) => item.id)).toEqual(["no-ctx"]);
    expect(stats.states.missingContextTotal).toBe(1);
  });

  test("结构状态 · 最近打磨：按更新时间倒序", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          understanding({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
          understanding({ id: "recent", updatedAt: "2026-06-17T00:00:00.000Z" }),
          understanding({ id: "newest", updatedAt: "2026-06-18T00:00:00.000Z" }),
        ],
      }),
      NOW,
    );

    expect(stats.states.recentlyWorked.map((item) => item.id)).toEqual(["newest", "recent", "old"]);
  });

  test("结构状态列表受长度上限约束", () => {
    const stats = computeRecapStats(
      input({
        understandings: Array.from({ length: STATE_LIST_LIMIT + 5 }, (_, index) =>
          understanding({
            id: `u-${index}`,
            contextCount: 0,
            createdAt: `2026-06-0${(index % 9) + 1}T00:00:00.000Z`,
          }),
        ),
      }),
      NOW,
    );

    expect(stats.states.islands).toHaveLength(STATE_LIST_LIMIT);
    expect(stats.states.islandTotal).toBe(STATE_LIST_LIMIT + 5);
    expect(stats.states.missingContext).toHaveLength(STATE_LIST_LIMIT);
  });
});
