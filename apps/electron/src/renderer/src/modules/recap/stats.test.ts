import { describe, expect, test } from "vitest";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import {
  computeRecapStats,
  HEATMAP_DAYS_PER_WEEK,
  RECAP_PERIODS,
  type RecapInput,
  type RecapPeriodId,
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
    domains?: { id: string; name: string }[];
    period?: RecapPeriodId;
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
    domains: overrides.domains ?? [],
    period: overrides.period ?? "week",
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

// 固定「今天」：2026-06-18（周四）
const NOW = new Date("2026-06-18T12:00:00.000Z");

describe("computeRecapStats", () => {
  test("空输入：热力图覆盖滚动窗口、资产与领域排名归零", () => {
    const stats = computeRecapStats(input(), NOW);

    expect(stats.assets.understanding).toEqual({ total: 0, period: 0 });
    expect(stats.assets.canvas).toEqual({ total: 0, period: 0 });
    expect(stats.assets.context).toEqual({ total: 0, period: 0 });
    expect(stats.domainRank).toEqual([]);
    for (const week of stats.heatmapWeeks) {
      expect(week).toHaveLength(HEATMAP_DAYS_PER_WEEK);
      for (const cell of week) {
        expect(cell.level).toBe(0);
      }
    }
  });

  test("滚动窗口「本周」：窗口起点为今天向前 6 天，窗口外格子为空", () => {
    const stats = computeRecapStats(input(), NOW);

    // 今天 06-18（周四），窗口起点 06-12；起点所在周一 = 06-08
    const firstWeek = stats.heatmapWeeks[0]!;
    // 06-08（周一）在窗口起点 06-12 之前 → 空白
    expect(firstWeek[0]?.date).toBeNull();
    // 06-12（周五）是窗口起点 → 有值（空数据）
    expect(firstWeek[4]?.date).toBe("2026-06-12");
    // 未来格子空白：本周（06-15 起）的周五 06-19 在窗口外
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

  test("资产双计数：总量 + period 窗口内新增", () => {
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

    expect(stats.assets.understanding).toEqual({ total: 2, period: 1 });
    expect(stats.assets.canvas).toEqual({ total: 1, period: 1 });
    expect(stats.assets.context).toEqual({ total: 1, period: 0 });
  });

  test("period 影响窗口与期内新增：近一月覆盖 30 天", () => {
    const stats = computeRecapStats(
      input({
        understandings: [
          understanding({ id: "in-month", createdAt: "2026-06-01T00:00:00.000Z" }),
          understanding({ id: "out-of-month", createdAt: "2026-05-10T00:00:00.000Z" }),
        ],
        period: "month",
      }),
      NOW,
    );

    expect(stats.period).toBe("month");
    expect(stats.assets.understanding).toEqual({ total: 2, period: 1 });
    // 30 天窗口起点 05-20（周三）→ 列起点所在周一 05-18（窗口外 → null），05-20 是首个有值列
    expect(stats.heatmapWeeks[0]![0]?.date).toBeNull();
    expect(stats.heatmapWeeks[0]![2]?.date).toBe("2026-05-20");
  });

  test("领域排名：按 total 降序、取 Top 10、期内新增随窗口", () => {
    const domains = [
      { id: "d1", name: "行为设计" },
      { id: "d2", name: "交易心理" },
      { id: "d3", name: "产品" },
    ];
    const stats = computeRecapStats(
      input({
        domains,
        understandings: [
          understanding({ id: "a", domainIds: ["d1"], createdAt: "2026-06-15T00:00:00.000Z" }),
          understanding({ id: "b", domainIds: ["d1"], createdAt: "2026-06-01T00:00:00.000Z" }),
          understanding({ id: "c", domainIds: ["d2"], createdAt: "2026-05-01T00:00:00.000Z" }),
        ],
      }),
      NOW,
    );

    expect(stats.domainRank).toEqual([
      { domainId: "d1", name: "行为设计", total: 2, period: 1 },
      { domainId: "d2", name: "交易心理", total: 1, period: 0 },
    ]);
    // d3 无理解 → 不出现
    expect(stats.domainRank.some((item) => item.domainId === "d3")).toBe(false);
  });

  test("领域排名 Top 10 上限", () => {
    const domains = Array.from({ length: 12 }, (_, index) => ({
      id: `d${index}`,
      name: `领域${index}`,
    }));
    const stats = computeRecapStats(
      input({
        domains,
        understandings: domains.flatMap((domain, index) =>
          Array.from({ length: index + 1 }, (_, j) =>
            understanding({ id: `${domain.id}-${j}`, domainIds: [domain.id] }),
          ),
        ),
      }),
      NOW,
    );

    expect(stats.domainRank).toHaveLength(10);
    // 最大的是最后一个领域（12 条）
    expect(stats.domainRank[0]?.domainId).toBe("d11");
  });

  test("全部 period：365 天窗口、列数约 53 周", () => {
    const stats = computeRecapStats(input({ period: "all" }), NOW);

    // 2026-06-18 往回 364 天 → 起点周约 52-53 列
    expect(stats.heatmapWeeks.length).toBeGreaterThanOrEqual(52);
    expect(stats.heatmapWeeks.length).toBeLessThanOrEqual(53);
  });

  test("RECAP_PERIODS 提供四档滚动窗口", () => {
    expect(RECAP_PERIODS.map((item) => item.days)).toEqual([7, 14, 30, 365]);
  });
});
