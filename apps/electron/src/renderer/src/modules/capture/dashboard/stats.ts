import { addDays, format, startOfDay, startOfWeek, subWeeks } from "date-fns";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

/**
 * capture dashboard 统计纯函数 —— 全部基于 UnderstandingSummaryDTO 的 createdAt /
 * contextCount，无需额外后端接口。
 */

/** 热力图展示的周数（GitHub 式，最近 12 周） */
export const HEATMAP_WEEKS = 12;
/** 一周 7 天 */
export const HEATMAP_DAYS_PER_WEEK = 7;

export type HeatmapCell = {
  /** 该格子代表的日期（YYYY-MM-DD）；范围外（本周未到来的日子）为 null */
  date: string | null;
  count: number;
  /** 0（无记录）～ 4（高频）五档 */
  level: number;
};

export type HeatmapWeek = readonly HeatmapCell[];

export type CaptureDashboardStats = {
  total: number;
  /** 最近 7 天（含今天）新建的理解数 */
  createdThisWeek: number;
  /** 连续记录天数（按 createdAt；今天无记录时从昨天起算，直到昨天为止） */
  streakDays: number;
  /** 全部理解的上下文总数 */
  contextTotal: number;
  /** 最近 12 周热力图数据，列 = 周（旧→新），行 = 周一→周日 */
  heatmapWeeks: readonly HeatmapWeek[];
};

const DAY_KEY_FORMAT = "yyyy-MM-dd";

function dayKey(date: Date): string {
  return format(date, DAY_KEY_FORMAT);
}

function levelForCount(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

/** createdAt → 每日计数 */
function buildDayCounts(understandings: readonly UnderstandingSummaryDTO[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const understanding of understandings) {
    const key = dayKey(new Date(understanding.createdAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function computeStreak(dayCounts: Map<string, number>, now: Date): number {
  const hasActivity = (date: Date) => (dayCounts.get(dayKey(date)) ?? 0) > 0;
  // 今天尚无记录时，streak 保持到昨天为止（GitHub 惯例）
  let cursor = startOfDay(now);
  if (!hasActivity(cursor)) cursor = addDays(cursor, -1);

  let streak = 0;
  while (hasActivity(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function buildHeatmap(dayCounts: Map<string, number>, now: Date): HeatmapWeek[] {
  // 以「本周一」为最后一列，向前推 11 周得到起点（GitHub 热力图惯例：周一开始，列=周）
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const gridStart = subWeeks(currentWeekStart, HEATMAP_WEEKS - 1);
  const todayKey = dayKey(now);

  const weeks: HeatmapWeek[] = [];
  for (let weekIndex = 0; weekIndex < HEATMAP_WEEKS; weekIndex += 1) {
    const days: HeatmapCell[] = [];
    for (let dayIndex = 0; dayIndex < HEATMAP_DAYS_PER_WEEK; dayIndex += 1) {
      const date = addDays(gridStart, weekIndex * HEATMAP_DAYS_PER_WEEK + dayIndex);
      const key = dayKey(date);
      // 范围外（本周尚未到来的日子）→ 空白格子，不计入
      if (key > todayKey) {
        days.push({ date: null, count: 0, level: 0 });
        continue;
      }
      const count = dayCounts.get(key) ?? 0;
      days.push({ date: key, count, level: levelForCount(count) });
    }
    weeks.push(days);
  }
  return weeks;
}

export function computeCaptureStats(
  understandings: readonly UnderstandingSummaryDTO[],
  now: Date = new Date(),
): CaptureDashboardStats {
  const dayCounts = buildDayCounts(understandings);

  const sevenDaysAgo = startOfDay(addDays(now, -6));
  const createdThisWeek = understandings.reduce(
    (sum, understanding) =>
      sum + (new Date(understanding.createdAt).getTime() >= sevenDaysAgo.getTime() ? 1 : 0),
    0,
  );

  const contextTotal = understandings.reduce(
    (sum, understanding) => sum + understanding.contextCount,
    0,
  );

  return {
    total: understandings.length,
    createdThisWeek,
    streakDays: computeStreak(dayCounts, now),
    contextTotal,
    heatmapWeeks: buildHeatmap(dayCounts, now),
  };
}
