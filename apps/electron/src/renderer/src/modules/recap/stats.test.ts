import { describe, expect, test } from "vitest";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import {
  computeRecapStats,
  HEATMAP_DAYS_PER_WEEK,
  RECAP_WINDOW_DAYS,
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
  overrides: {
    understandings?: unknown[];
    canvases?: unknown[];
    recap?: Partial<RecapData>;
  } = {},
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

// 固定「今天」：2026-06-18（周四）；完整窗口起点 = 2025-06-19（往回 364 天）
const NOW = new Date("2026-06-18T12:00:00.000Z");

describe("computeRecapStats", () => {
  test("空输入：热力图覆盖完整窗口、资产与趋势归零", () => {
    const stats = computeRecapStats(input(), NOW);

    expect(stats.assets.understanding).toBe(0);
    expect(stats.assets.canvas).toBe(0);
    expect(stats.assets.context).toBe(0);
    expect(stats.trend).toHaveLength(RECAP_WINDOW_DAYS);
    for (const point of stats.trend) {
      expect(point.understanding).toBe(0);
      expect(point.canvas).toBe(0);
      expect(point.context).toBe(0);
    }
    for (const week of stats.heatmapWeeks) {
      expect(week).toHaveLength(HEATMAP_DAYS_PER_WEEK);
      for (const cell of week) {
        expect(cell.level).toBe(0);
      }
    }
  });

  test("完整窗口：起点为今天向前 364 天，窗口外格子为空", () => {
    const stats = computeRecapStats(input(), NOW);

    // 今天 06-18（周四），窗口起点 2025-06-19（周四）；起点所在周一 = 2025-06-16
    const firstWeek = stats.heatmapWeeks[0]!;
    // 06-16（周一）～ 06-18（周三）在窗口起点之前 → 空白
    expect(firstWeek[0]?.date).toBeNull();
    expect(firstWeek[2]?.date).toBeNull();
    // 06-19（周四）是窗口起点 → 有值（空数据）
    expect(firstWeek[3]?.date).toBe("2025-06-19");
    // 未来格子空白：本周（2026-06-15 起）的周五 06-19 在窗口外
    const thisWeek = stats.heatmapWeeks.at(-1)!;
    expect(thisWeek[4]?.date).toBeNull();
  });

  test("热力图按日细分：对话（会话数/消息数）与创建资产分开计", () => {
    const stats = computeRecapStats(
      input({
        understandings: [understanding({ id: "a", createdAt: "2026-06-15T08:00:00.000Z" })],
        canvases: [canvas({ id: "c1", createdAt: "2026-06-15T09:00:00.000Z" })],
        recap: {
          sessions: [
            session({
              sessionId: "s1",
              createdAt: "2026-06-15T10:00:00.000Z",
              userMessageDates: [
                "2026-06-15T10:00:00.000Z",
                "2026-06-15T11:00:00.000Z",
                "2026-06-15T12:00:00.000Z",
              ],
            }),
          ],
          contextCreates: ["2026-06-15T13:00:00.000Z"],
        },
      }),
      NOW,
    );

    const thisWeek = stats.heatmapWeeks.at(-1)!;
    const monday = thisWeek[0]!; // 06-15 周一
    expect(monday.date).toBe("2026-06-15");
    expect(monday.conversations).toBe(1);
    expect(monday.messages).toBe(3);
    // 资产 = 理解 1 + 画布 1 + 上下文 1 = 3
    expect(monday.assets).toBe(3);
    // 档位按 对话+资产 = 4 → 2 档
    expect(monday.level).toBe(2);
  });

  test("资产累计存量：三类资产总量，无期内新增口径", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          understanding({ id: "old", createdAt: "2026-06-01T00:00:00.000Z" }),
          understanding({ id: "recent", createdAt: "2026-06-15T00:00:00.000Z" }),
        ],
        canvases: [canvas({ id: "c1", createdAt: "2026-06-15T00:00:00.000Z" })],
        recap: { contextCreates: ["2026-06-01T00:00:00.000Z"] },
      }),
      NOW,
    );

    expect(stats.assets.understanding).toBe(2);
    expect(stats.assets.canvas).toBe(1);
    expect(stats.assets.context).toBe(1);
  });

  test("趋势曲线：按日累计、含窗口前存量基线、终点与累计存量一致", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          // 窗口起点（2025-06-19）之前的历史存量 → 基线
          understanding({ id: "before", createdAt: "2025-01-01T00:00:00.000Z" }),
          // 恰好落在窗口起点当天 → 计入首个点
          understanding({ id: "at-start", createdAt: "2025-06-19T00:00:00.000Z" }),
          understanding({ id: "a", createdAt: "2026-06-10T00:00:00.000Z" }),
          understanding({ id: "b", createdAt: "2026-06-15T00:00:00.000Z" }),
        ],
        canvases: [canvas({ id: "c1", createdAt: "2026-06-12T09:00:00.000Z" })],
        recap: { contextCreates: ["2026-06-01T08:00:00.000Z"] },
      }),
      NOW,
    );

    const pointByDate = new Map(stats.trend.map((point) => [point.date, point]));

    // 首个点 = 窗口起点：理解 1（历史基线）+ 1（起点当天）＝2，画布/上下文为 0
    expect(stats.trend[0]).toEqual({
      date: "2025-06-19",
      understanding: 2,
      canvas: 0,
      context: 0,
    });

    expect(pointByDate.get("2026-06-01")).toMatchObject({
      understanding: 2,
      canvas: 0,
      context: 1,
    });
    expect(pointByDate.get("2026-06-10")).toMatchObject({
      understanding: 3,
      canvas: 0,
      context: 1,
    });
    expect(pointByDate.get("2026-06-12")).toMatchObject({
      understanding: 3,
      canvas: 1,
      context: 1,
    });
    expect(pointByDate.get("2026-06-15")).toMatchObject({
      understanding: 4,
      canvas: 1,
      context: 1,
    });

    // 终点 = 今日，且与累计存量一致
    const last = stats.trend.at(-1)!;
    expect(last.date).toBe("2026-06-18");
    expect(last.understanding).toBe(stats.assets.understanding);
    expect(last.canvas).toBe(stats.assets.canvas);
    expect(last.context).toBe(stats.assets.context);
  });

  test("趋势曲线：覆盖完整窗口（365 个点，首 = 窗口起点、尾 = 今日）", () => {
    const stats = computeRecapStats(input(), NOW);

    expect(stats.trend).toHaveLength(RECAP_WINDOW_DAYS);
    expect(stats.trend[0]?.date).toBe("2025-06-19");
    expect(stats.trend.at(-1)?.date).toBe("2026-06-18");
  });

  test("完整窗口：365 天、热力图列数约 53 周", () => {
    const stats = computeRecapStats(input(), NOW);

    // 2026-06-18 往回 364 天 → 起点周约 52-53 列
    expect(stats.heatmapWeeks.length).toBeGreaterThanOrEqual(52);
    expect(stats.heatmapWeeks.length).toBeLessThanOrEqual(53);
  });
});
