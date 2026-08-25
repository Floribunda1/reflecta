import { addDays, format, startOfDay, subDays } from "date-fns";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/shared";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

/**
 * 捕获页顶部「参与概览」统计纯函数 —— 如实呈现用户在 Product 付出的 effort。
 * 不承载诊断逻辑（孤岛/缺上下文等由工作界面负责）：参与热力图 + 资产指标（累计存量）。
 * 参与口径：对话（会话级，hover 另含消息数）+ 创建资产（理解/画布/上下文/画布元素连线，不含编辑）。
 * 热力图始终覆盖完整时间范围（365 天上限），不做时间范围筛选。
 */

/** 热力图覆盖的完整时间范围（天）——固定窗口，不随筛选变化 */
export const PARTICIPATION_WINDOW_DAYS = 365;

/** 热力图库（react-activity-calendar）的输入条目：窗口内每天一条，空天 count=0。 */
export type ActivityDay = {
  date: string;
  count: number;
  level: number;
};

/** 某天的细分（对话/消息/各类创建），hover 与点击明细共用 */
export type DayDetailCounts = {
  conversations: number;
  messages: number;
  /** 当天创建的理解数 */
  understandingCreated: number;
  /** 当天创建的画布数（画布本身） */
  canvasCreated: number;
  /** 当天创建的上下文数 */
  contextCreated: number;
  /** 画布内元素创建数（计入热力强度，不单列展示） */
  canvasElementCreated: number;
  /** 画布连线创建数（计入热力强度，不单列展示） */
  canvasEdgeCreated: number;
};

/** 三类资产累计存量 */
export type ParticipationAssets = {
  understanding: number;
  canvas: number;
  context: number;
};

export type ParticipationInput = {
  understandings: readonly UnderstandingSummaryDTO[];
  canvases: readonly CanvasDTO[];
  recap: RecapData;
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

/** 固定窗口起点（含）：今天向前 PARTICIPATION_WINDOW_DAYS-1 天 */
function windowStart(now: Date): Date {
  return startOfDay(subDays(now, PARTICIPATION_WINDOW_DAYS - 1));
}

/** 按日细分参与：对话（会话数/消息数）+ 各类创建（理解/画布/上下文/画布元素/连线） */
function buildDayParticipation(input: ParticipationInput): Map<string, DayDetailCounts> {
  const map = new Map<string, DayDetailCounts>();
  const add = (iso: string, mutate: (cell: DayDetailCounts) => void) => {
    const key = dayKey(new Date(iso));
    const cell = map.get(key) ?? {
      conversations: 0,
      messages: 0,
      understandingCreated: 0,
      canvasCreated: 0,
      contextCreated: 0,
      canvasElementCreated: 0,
      canvasEdgeCreated: 0,
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
      cell.understandingCreated += 1;
    });
  }
  for (const iso of input.recap.contextCreates) {
    add(iso, (cell) => {
      cell.contextCreated += 1;
    });
  }
  for (const canvas of input.canvases) {
    add(canvas.createdAt, (cell) => {
      cell.canvasCreated += 1;
    });
  }
  for (const iso of input.recap.canvasElementCreates) {
    add(iso, (cell) => {
      cell.canvasElementCreated += 1;
    });
  }
  for (const iso of input.recap.canvasEdgeCreates) {
    add(iso, (cell) => {
      cell.canvasEdgeCreated += 1;
    });
  }
  return map;
}

export function computeParticipationAssets(input: ParticipationInput): ParticipationAssets {
  return {
    understanding: input.understandings.length,
    canvas: input.canvases.length,
    context: input.recap.contextCreates.length,
  };
}

/**
 * 完整窗口内逐日活动数据（供 react-activity-calendar 渲染）：
 * 每天一条（含空天 count=0），首尾条目决定库的时间跨度；
 * details 提供同一日的细分（对话/消息/创建资产）。
 */
export function buildParticipationActivity(
  input: ParticipationInput,
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
    const assets =
      (cell?.understandingCreated ?? 0) +
      (cell?.canvasCreated ?? 0) +
      (cell?.contextCreated ?? 0) +
      (cell?.canvasElementCreated ?? 0) +
      (cell?.canvasEdgeCreated ?? 0);
    const total = conversations + assets;
    days.push({ date: key, count: total, level: levelForCount(total) });
    cursor = addDays(cursor, 1);
  }

  const details = new Map<string, DayDetailCounts>();
  for (const [key, cell] of participation) {
    if (key >= dayKey(start) && key <= todayKey) {
      details.set(key, cell);
    }
  }
  return { days, details };
}
