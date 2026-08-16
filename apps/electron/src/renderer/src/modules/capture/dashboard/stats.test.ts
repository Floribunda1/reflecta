import { describe, expect, test } from "vitest";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { computeCaptureStats, HEATMAP_DAYS_PER_WEEK, HEATMAP_WEEKS } from "./stats";

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

// 固定「今天」：2026-06-18（周四），保证热力图/周界可复现
const NOW = new Date("2026-06-18T12:00:00.000Z");

describe("computeCaptureStats", () => {
  test("空列表：全部统计归零，热力图铺满 12 周空白格", () => {
    const stats = computeCaptureStats([], NOW);

    expect(stats.total).toBe(0);
    expect(stats.createdThisWeek).toBe(0);
    expect(stats.streakDays).toBe(0);
    expect(stats.contextTotal).toBe(0);
    expect(stats.heatmapWeeks).toHaveLength(HEATMAP_WEEKS);
    for (const week of stats.heatmapWeeks) {
      expect(week).toHaveLength(HEATMAP_DAYS_PER_WEEK);
      for (const cell of week) {
        expect(cell.level).toBe(0);
      }
    }
  });

  test("本周新增只统计最近 7 天（含今天）", () => {
    const stats = computeCaptureStats(
      [
        understanding({ id: "today", createdAt: "2026-06-18T08:00:00.000Z" }),
        understanding({ id: "six-days-ago", createdAt: "2026-06-12T08:00:00.000Z" }),
        understanding({ id: "seven-days-ago", createdAt: "2026-06-11T08:00:00.000Z" }),
        understanding({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      ],
      NOW,
    );

    expect(stats.total).toBe(4);
    expect(stats.createdThisWeek).toBe(2);
  });

  test("上下文总数 = contextCount 之和", () => {
    const stats = computeCaptureStats(
      [
        understanding({ id: "a", contextCount: 3 }),
        understanding({ id: "b", contextCount: 0 }),
        understanding({ id: "c", contextCount: 5 }),
      ],
      NOW,
    );

    expect(stats.contextTotal).toBe(8);
  });

  test("连续记录天数：今天有记录则从今天起算", () => {
    const stats = computeCaptureStats(
      [
        understanding({ id: "d1", createdAt: "2026-06-18T08:00:00.000Z" }),
        understanding({ id: "d2", createdAt: "2026-06-17T08:00:00.000Z" }),
        understanding({ id: "d3", createdAt: "2026-06-16T08:00:00.000Z" }),
      ],
      NOW,
    );

    expect(stats.streakDays).toBe(3);
  });

  test("连续记录天数：今天无记录时保持到昨天为止", () => {
    const stats = computeCaptureStats(
      [
        understanding({ id: "d1", createdAt: "2026-06-17T08:00:00.000Z" }),
        understanding({ id: "d2", createdAt: "2026-06-16T08:00:00.000Z" }),
      ],
      NOW,
    );

    expect(stats.streakDays).toBe(2);
  });

  test("连续记录天数：中间断档则 streak 归零重算", () => {
    const stats = computeCaptureStats(
      [
        understanding({ id: "d1", createdAt: "2026-06-18T08:00:00.000Z" }),
        understanding({ id: "old", createdAt: "2026-06-01T08:00:00.000Z" }),
      ],
      NOW,
    );

    expect(stats.streakDays).toBe(1);
  });

  test("热力图：列=周（旧→新）、行=周一→周日、格子含日期与档位", () => {
    const stats = computeCaptureStats(
      [
        understanding({ id: "monday", createdAt: "2026-06-15T08:00:00.000Z" }),
        understanding({ id: "monday-2", createdAt: "2026-06-15T09:00:00.000Z" }),
        understanding({ id: "monday-3", createdAt: "2026-06-15T10:00:00.000Z" }),
        understanding({ id: "sunday", createdAt: "2026-06-14T08:00:00.000Z" }),
      ],
      NOW,
    );

    // 2026-06-18 是周四，本周一 = 06-15
    const thisWeek = stats.heatmapWeeks.at(-1)!;
    expect(thisWeek[0]?.date).toBe("2026-06-15");
    expect(thisWeek[0]?.count).toBe(3);
    expect(thisWeek[0]?.level).toBe(2); // 3 条 → 档位 2
    expect(thisWeek[4]?.date).toBeNull(); // 周五（06-19）是未来 → 空白格
    // 周五是未来 → 空白格
    expect(thisWeek[4]?.date).toBeNull();
    expect(thisWeek[4]?.count).toBe(0);
    expect(thisWeek[4]?.level).toBe(0);
  });

  test("热力图：12 周起点是 11 周前的周一", () => {
    const stats = computeCaptureStats([], NOW);
    const firstWeek = stats.heatmapWeeks[0]!;

    // 2026-06-18 周四 → 本周一 06-15 → 起点 03-30
    expect(firstWeek[0]?.date).toBe("2026-03-30");
  });

  test("热力图档位分档：0 / 1-2 / 3-4 / 5-7 / 8+", () => {
    // 本周（06-15 周一 ～ 06-18 周四）内分四个日期，每个档位一条
    const days = ["2026-06-18", "2026-06-17", "2026-06-16", "2026-06-15"];
    const counts = [1, 3, 5, 8];
    const stats = computeCaptureStats(
      days.flatMap((day, dayIndex) =>
        Array.from({ length: counts[dayIndex]! }, (_, index) =>
          understanding({ id: `${day}-${index}`, createdAt: `${day}T08:00:00.000Z` }),
        ),
      ),
      NOW,
    );

    const thisWeek = stats.heatmapWeeks.at(-1)!;
    const levelOf = (day: string) => thisWeek.find((cell) => cell.date === day)?.level;
    expect(levelOf("2026-06-18")).toBe(1); // 1 条
    expect(levelOf("2026-06-17")).toBe(2); // 3 条
    expect(levelOf("2026-06-16")).toBe(3); // 5 条
    expect(levelOf("2026-06-15")).toBe(4); // 8 条
  });
});
