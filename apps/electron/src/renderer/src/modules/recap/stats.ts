import { addDays, format, startOfDay, startOfWeek, subDays } from "date-fns";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

/**
 * 回顾页（Recap）统计纯函数 —— 如实呈现用户在 Product 付出的 effort。
 * 不承载诊断逻辑（孤岛/缺上下文等由工作界面负责）：过程数据（热力图）+ 沉淀资产（累计存量 + 累计趋势）。
 * 参与口径：对话（会话级，hover 另含消息数）+ 创建资产（理解/画布/上下文/画布元素连线，不含编辑）。
 * 热力图与趋势曲线始终覆盖完整时间范围（365 天上限），不做时间范围筛选。
 */

/** 一周 7 天 */
export const HEATMAP_DAYS_PER_WEEK = 7;

/** 热力图与趋势曲线覆盖的完整时间范围（天）——固定窗口，不随筛选变化 */
export const RECAP_WINDOW_DAYS = 365;

export type HeatmapCell = {
  /** 该格子代表的日期（YYYY-MM-DD）；范围外（窗口起点之前 / 今天之后）为 null */
  date: string | null;
  /** 当天开始的对话数（会话数） */
  conversations: number;
  /** 当天的用户消息数 */
  messages: number;
  /** 当天创建的资产数（理解/画布/上下文/画布元素连线） */
  assets: number;
  /** 0（无参与）～ 4（高参与）五档，按 对话 + 资产 计 */
  level: number;
};

export type HeatmapWeek = readonly HeatmapCell[];

/** 三类资产累计存量 */
export type AssetCounts = {
  understanding: number;
  canvas: number;
  context: number;
};

/** 趋势曲线上的一个点：某一天三类资产的累计值 */
export type TrendPoint = {
  /** 该点日期（YYYY-MM-DD） */
  date: string;
  understanding: number;
  canvas: number;
  context: number;
};

export type RecapStats = {
  /** 热力图：列 = 周（旧→新），行 = 周一→周日，覆盖完整窗口 */
  heatmapWeeks: readonly HeatmapWeek[];
  /** 三类资产累计存量（含窗口外历史） */
  assets: AssetCounts;
  /** 三类资产按日累计趋势（覆盖完整窗口，从窗口起点到今日，含窗口前存量基线） */
  trend: TrendPoint[];
};

export type RecapInput = {
  understandings: readonly UnderstandingSummaryDTO[];
  canvases: readonly CanvasDTO[];
  recap: RecapData;
};

/** 热力图库（react-activity-calendar）的输入条目：窗口内每天一条，空天 count=0。 */
export type ActivityDay = {
  date: string;
  count: number;
  level: number;
};

/** 某天的 hover 细分（对话/消息/创建资产） */
export type DayDetailCounts = {
  conversations: number;
  messages: number;
  assets: number;
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

/** 固定窗口起点（含）：今天向前 RECAP_WINDOW_DAYS-1 天 */
function windowStart(now: Date): Date {
  return startOfDay(subDays(now, RECAP_WINDOW_DAYS - 1));
}

/** 按日细分参与：对话（会话数/消息数）+ 创建资产数 */
function buildDayParticipation(input: RecapInput): Map<string, HeatmapCell> {
  const map = new Map<string, HeatmapCell>();
  const add = (iso: string, mutate: (cell: HeatmapCell) => void) => {
    const key = dayKey(new Date(iso));
    const cell = map.get(key) ?? {
      date: key,
      conversations: 0,
      messages: 0,
      assets: 0,
      level: 0,
    };
    mutate(cell);
    map.set(key, cell);
  };

  for (const session of input.recap.sessions) {
    add(session.createdAt, (cell) => {
      cell.conversations += 1;
    });
    for (const iso of session.userMessageDates) {
      add(iso, (cell) => {
        cell.messages += 1;
      });
    }
  }
  for (const understanding of input.understandings) {
    add(understanding.createdAt, (cell) => {
      cell.assets += 1;
    });
  }
  for (const iso of input.recap.contextCreates) {
    add(iso, (cell) => {
      cell.assets += 1;
    });
  }
  for (const canvas of input.canvases) {
    add(canvas.createdAt, (cell) => {
      cell.assets += 1;
    });
  }
  for (const iso of input.recap.canvasElementCreates) {
    add(iso, (cell) => {
      cell.assets += 1;
    });
  }
  for (const iso of input.recap.canvasEdgeCreates) {
    add(iso, (cell) => {
      cell.assets += 1;
    });
  }
  return map;
}

function buildHeatmap(
  participation: Map<string, HeatmapCell>,
  start: Date,
  now: Date,
): HeatmapWeek[] {
  // 列 = 周：从窗口起点所在周的周一开始，列对齐到今天所在周
  const gridStart = startOfWeek(start, { weekStartsOn: 1 });
  const todayKey = dayKey(now);
  const startKey = dayKey(start);

  const weeks: HeatmapWeek[] = [];
  let gridCursor = gridStart;
  while (gridCursor <= now) {
    const days: HeatmapCell[] = [];
    for (let dayIndex = 0; dayIndex < HEATMAP_DAYS_PER_WEEK; dayIndex += 1) {
      const date = addDays(gridCursor, dayIndex);
      const key = dayKey(date);
      if (key < startKey || key > todayKey) {
        days.push({ date: null, conversations: 0, messages: 0, assets: 0, level: 0 });
        continue;
      }
      const cell = participation.get(key) ?? {
        date: key,
        conversations: 0,
        messages: 0,
        assets: 0,
        level: 0,
      };
      const total = cell.conversations + cell.assets;
      days.push({ ...cell, level: levelForCount(total) });
    }
    weeks.push(days);
    gridCursor = addDays(gridCursor, HEATMAP_DAYS_PER_WEEK);
  }
  return weeks;
}

function computeAssets(input: RecapInput): AssetCounts {
  return {
    understanding: input.understandings.length,
    canvas: input.canvases.length,
    context: input.recap.contextCreates.length,
  };
}

/** 升序时间戳列表，供趋势累计时双指针推进 */
function sortedTimestamps(items: readonly { createdAt: string }[]): number[] {
  return items.map((item) => new Date(item.createdAt).getTime()).sort((a, b) => a - b);
}

/** 三类资产按日累计：起点含窗口前存量基线，终点 = 今日（与累计存量一致） */
function computeTrend(input: RecapInput, start: Date, now: Date): TrendPoint[] {
  const windowStartMs = start.getTime();
  const understandingTimes = sortedTimestamps(input.understandings);
  const canvasTimes = sortedTimestamps(input.canvases);
  const contextTimes = input.recap.contextCreates
    .map((iso) => new Date(iso).getTime())
    .sort((a, b) => a - b);

  // 基线：窗口起点之前的历史存量（趋势从存量出发，而非从 0）
  const countBefore = (times: number[]): number => {
    let index = 0;
    while (index < times.length && times[index] < windowStartMs) index += 1;
    return index;
  };

  const points: TrendPoint[] = [];
  const todayKey = dayKey(now);
  let understandingIndex = countBefore(understandingTimes);
  let canvasIndex = countBefore(canvasTimes);
  let contextIndex = countBefore(contextTimes);
  let understanding = understandingIndex;
  let canvas = canvasIndex;
  let context = contextIndex;

  let cursor = start;
  while (dayKey(cursor) <= todayKey) {
    // 次日 0 点 = 当日（含）截止；窗口起点当天从基线继续累计
    const dayEnd = addDays(cursor, 1).getTime();
    while (
      understandingIndex < understandingTimes.length &&
      understandingTimes[understandingIndex] < dayEnd
    ) {
      understanding += 1;
      understandingIndex += 1;
    }
    while (canvasIndex < canvasTimes.length && canvasTimes[canvasIndex] < dayEnd) {
      canvas += 1;
      canvasIndex += 1;
    }
    while (contextIndex < contextTimes.length && contextTimes[contextIndex] < dayEnd) {
      context += 1;
      contextIndex += 1;
    }
    points.push({ date: dayKey(cursor), understanding, canvas, context });
    cursor = addDays(cursor, 1);
  }
  return points;
}

export function computeRecapStats(input: RecapInput, now: Date = new Date()): RecapStats {
  const start = windowStart(now);
  const participation = buildDayParticipation(input);

  return {
    heatmapWeeks: buildHeatmap(participation, start, now),
    assets: computeAssets(input),
    trend: computeTrend(input, start, now),
  };
}

/**
 * 完整窗口内逐日活动数据（供 react-activity-calendar 渲染）：
 * 每天一条（含空天 count=0），首尾条目决定库的时间跨度；
 * details 提供同一日的 hover 细分（对话/消息/创建资产）。
 */
export function buildActivityData(
  input: RecapInput,
  now: Date = new Date(),
): { days: ActivityDay[]; details: Map<string, DayDetailCounts> } {
  const start = windowStart(now);
  const participation = buildDayParticipation(input);
  const todayKey = dayKey(now);

  const days: ActivityDay[] = [];
  let cursor = start;
  while (dayKey(cursor) <= todayKey) {
    const key = dayKey(cursor);
    const cell = participation.get(key);
    const conversations = cell?.conversations ?? 0;
    const assets = cell?.assets ?? 0;
    const total = conversations + assets;
    days.push({ date: key, count: total, level: levelForCount(total) });
    cursor = addDays(cursor, 1);
  }

  const details = new Map<string, DayDetailCounts>();
  for (const [key, cell] of participation) {
    if (key >= dayKey(start) && key <= todayKey) {
      details.set(key, {
        conversations: cell.conversations,
        messages: cell.messages,
        assets: cell.assets,
      });
    }
  }
  return { days, details };
}
