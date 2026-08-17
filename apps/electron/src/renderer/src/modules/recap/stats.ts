import { addDays, format, startOfDay, startOfWeek, subDays } from "date-fns";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

/**
 * 回顾页（Recap）统计纯函数 —— 如实呈现用户在 Product 付出的 effort。
 * 不承载诊断逻辑（孤岛/缺上下文等由工作界面负责）：过程数据（热力图）+ 沉淀资产（存量 + 期内新增）。
 * 参与口径：对话（会话级，hover 另含消息数）+ 创建资产（理解/画布/上下文/画布元素连线，不含编辑）。
 */

/** 一周 7 天 */
export const HEATMAP_DAYS_PER_WEEK = 7;

/** period 筛选档位（滚动窗口：本周=近 7 天、近两周=14、近一月=30、全部=365 天上限） */
export const RECAP_PERIODS = [
  { id: "week", label: "本周", days: 7 },
  { id: "twoWeeks", label: "近两周", days: 14 },
  { id: "month", label: "近一月", days: 30 },
  { id: "all", label: "全部", days: 365 },
] as const;

export type RecapPeriodId = (typeof RECAP_PERIODS)[number]["id"];

export type RecapPeriod = (typeof RECAP_PERIODS)[number];

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

/** 资产存量 + 期内新增（period 窗口内创建） */
export type AssetCounts = {
  understanding: { total: number; period: number };
  canvas: { total: number; period: number };
  context: { total: number; period: number };
};

export type DomainRankItem = {
  domainId: string;
  name: string;
  total: number;
  period: number;
};

export type RecapStats = {
  period: RecapPeriodId;
  /** 热力图：列 = 周（旧→新），行 = 周一→周日，覆盖滚动窗口 */
  heatmapWeeks: readonly HeatmapWeek[];
  assets: AssetCounts;
  /** 按理解数降序的领域排名（Top 10） */
  domainRank: DomainRankItem[];
};

export type RecapInput = {
  understandings: readonly UnderstandingSummaryDTO[];
  canvases: readonly CanvasDTO[];
  recap: RecapData;
  domains: readonly { id: string; name: string }[];
  period: RecapPeriodId;
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

/** 滚动窗口起点（含）：今天向前 days-1 天 */
function windowStart(period: RecapPeriod, now: Date): Date {
  return startOfDay(subDays(now, period.days - 1));
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
  period: RecapPeriod,
  now: Date,
): HeatmapWeek[] {
  const start = windowStart(period, now);
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

function countCreatedInWindow(iso: string, start: Date): boolean {
  return new Date(iso).getTime() >= start.getTime();
}

function computeAssets(input: RecapInput, start: Date): AssetCounts {
  let understandingPeriod = 0;
  for (const understanding of input.understandings) {
    if (countCreatedInWindow(understanding.createdAt, start)) understandingPeriod += 1;
  }
  let canvasPeriod = 0;
  for (const canvas of input.canvases) {
    if (countCreatedInWindow(canvas.createdAt, start)) canvasPeriod += 1;
  }
  const contextPeriod = input.recap.contextCreates.filter((iso) =>
    countCreatedInWindow(iso, start),
  ).length;

  return {
    understanding: { total: input.understandings.length, period: understandingPeriod },
    canvas: { total: input.canvases.length, period: canvasPeriod },
    context: { total: input.recap.contextCreates.length, period: contextPeriod },
  };
}

function computeDomainRank(input: RecapInput, start: Date): DomainRankItem[] {
  const nameById = new Map(input.domains.map((domain) => [domain.id, domain.name]));
  const counts = new Map<string, { total: number; period: number }>();

  const bump = (domainId: string, inWindow: boolean) => {
    const entry = counts.get(domainId) ?? { total: 0, period: 0 };
    entry.total += 1;
    if (inWindow) entry.period += 1;
    counts.set(domainId, entry);
  };

  for (const understanding of input.understandings) {
    const inWindow = countCreatedInWindow(understanding.createdAt, start);
    for (const domainId of understanding.domainIds) bump(domainId, inWindow);
  }

  return [...counts.entries()]
    .map(([domainId, counts]) => ({
      domainId,
      name: nameById.get(domainId) ?? domainId,
      total: counts.total,
      period: counts.period,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, 10);
}

export function computeRecapStats(input: RecapInput, now: Date = new Date()): RecapStats {
  const period = RECAP_PERIODS.find((item) => item.id === input.period) ?? RECAP_PERIODS[0];
  const start = windowStart(period, now);
  const participation = buildDayParticipation(input);

  return {
    period: period.id,
    heatmapWeeks: buildHeatmap(participation, period, now),
    assets: computeAssets(input, start),
    domainRank: computeDomainRank(input, start),
  };
}
