import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import type { RecapData, SessionParticipation } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

/**
 * 回顾页（Recap）统计纯函数 —— 参与过程 + 沉淀资产。
 * 参与口径见 PRD §4：对话（会话级）、写/编辑理解、补上下文、画布新增元素或连线；
 * 产出量只在中性资产块呈现，不进入激励性展示。
 */

/** 热力图展示的周数（最近 12 周，与旧 CaptureStats 一致） */
export const HEATMAP_WEEKS = 12;
/** 一周 7 天 */
export const HEATMAP_DAYS_PER_WEEK = 7;
/** 结构状态列表的最大条数 */
export const STATE_LIST_LIMIT = 12;

export type HeatmapCell = {
  /** 该格子代表的日期（YYYY-MM-DD）；范围外（本周未到来的日子）为 null */
  date: string | null;
  count: number;
  /** 0（无参与）～ 4（高参与）五档 */
  level: number;
};

export type HeatmapWeek = readonly HeatmapCell[];

/** 今日实时层：参与过程的状态 */
export type TodayActivity = {
  /** 今天有消息的对话数 */
  conversations: number;
  /** 今天的用户消息数 */
  messages: number;
  /** 今天的沉淀动作数（创建/编辑理解、补上下文、画布元素/连线） */
  actions: number;
};

/** 结构状态：可行动的列表（不是数字） */
export type AssetStateItem = {
  id: string;
  title: string;
  /** 描述性时间（更新时间或创建时间） */
  updatedAt: string;
};

export type RecapStats = {
  /** 今日实时层 */
  today: TodayActivity;
  /** 最近 12 周参与热力图，列 = 周（旧→新），行 = 周一→周日 */
  heatmapWeeks: readonly HeatmapWeek[];
  /** 沉淀资产 · 分列计数 */
  assets: {
    understandingTotal: number;
    canvasTotal: number;
    contextTotal: number;
  };
  /** 沉淀资产 · 结构状态 */
  states: {
    /** 孤岛：未出现在任何画布的理解 */
    islands: AssetStateItem[];
    islandTotal: number;
    /** 缺上下文的理解 */
    missingContext: AssetStateItem[];
    missingContextTotal: number;
    /** 最近打磨：最近被编辑的理解 */
    recentlyWorked: AssetStateItem[];
  };
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

/**
 * 按日累计参与事件数。
 * 参与事件 = 会话开始（1 次/会话）+ 理解创建 + 理解编辑 + 上下文创建 + 画布创建 + 画布元素/连线创建。
 * 对话的每条用户消息单独计入消息维度，但热力图按「参与动作」计。
 */
function buildDayCounts(input: RecapInput): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (iso: string, amount: number) => {
    const key = dayKey(new Date(iso));
    counts.set(key, (counts.get(key) ?? 0) + amount);
  };

  for (const session of input.recap.sessions) add(session.createdAt, 1);
  for (const understanding of input.understandings) {
    add(understanding.createdAt, 1);
    add(understanding.updatedAt, 1);
  }
  for (const iso of input.recap.contextCreates) add(iso, 1);
  for (const canvas of input.canvases) add(canvas.createdAt, 1);
  for (const iso of input.recap.canvasElementCreates) add(iso, 1);
  for (const iso of input.recap.canvasEdgeCreates) add(iso, 1);
  return counts;
}

export type RecapInput = {
  understandings: readonly UnderstandingSummaryDTO[];
  canvases: readonly CanvasDTO[];
  recap: RecapData;
};

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

function isToday(iso: string, now: Date): boolean {
  return dayKey(new Date(iso)) === dayKey(now);
}

function computeToday(
  input: RecapInput,
  sessions: readonly SessionParticipation[],
  now: Date,
): TodayActivity {
  const understandingActions = input.understandings.reduce((sum, understanding) => {
    let actions = 0;
    if (isToday(understanding.createdAt, now)) actions += 1;
    if (isToday(understanding.updatedAt, now)) actions += 1;
    return sum + actions;
  }, 0);
  const contextActions = input.recap.contextCreates.filter((iso) => isToday(iso, now)).length;
  const canvasActions = input.canvases.filter((canvas) => isToday(canvas.createdAt, now)).length;
  const elementActions =
    input.recap.canvasElementCreates.filter((iso) => isToday(iso, now)).length +
    input.recap.canvasEdgeCreates.filter((iso) => isToday(iso, now)).length;

  let conversations = 0;
  let messages = 0;
  for (const session of sessions) {
    const todayMessages = session.userMessageDates.filter((iso) => isToday(iso, now)).length;
    if (todayMessages > 0) conversations += 1;
    messages += todayMessages;
  }

  return {
    conversations,
    messages,
    actions: understandingActions + contextActions + canvasActions + elementActions,
  };
}

function toStateItem(understanding: UnderstandingSummaryDTO): AssetStateItem {
  return {
    id: understanding.id,
    title: understanding.title?.trim() || "(无标题)",
    updatedAt: understanding.updatedAt,
  };
}

function computeAssetStates(input: RecapInput): RecapStats["states"] {
  const referenced = new Set(input.recap.canvasReferencedUnderstandingIds);
  const sortedByUpdate = [...input.understandings].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  const islands = sortedByUpdate.filter((u) => !referenced.has(u.id));
  const missingContext = sortedByUpdate.filter((u) => u.contextCount === 0);

  return {
    islands: islands.slice(0, STATE_LIST_LIMIT).map(toStateItem),
    islandTotal: islands.length,
    missingContext: missingContext.slice(0, STATE_LIST_LIMIT).map(toStateItem),
    missingContextTotal: missingContext.length,
    recentlyWorked: sortedByUpdate.slice(0, STATE_LIST_LIMIT).map(toStateItem),
  };
}

export function computeRecapStats(input: RecapInput, now: Date = new Date()): RecapStats {
  const dayCounts = buildDayCounts(input);

  return {
    today: computeToday(input, input.recap.sessions, now),
    heatmapWeeks: buildHeatmap(dayCounts, now),
    assets: {
      understandingTotal: input.understandings.length,
      canvasTotal: input.canvases.length,
      contextTotal: input.recap.contextCreates.length,
    },
    states: computeAssetStates(input),
  };
}
