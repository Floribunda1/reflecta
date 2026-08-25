import { describe, expect, test } from "vitest";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/shared";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import {
  buildParticipationActivity,
  computeParticipationAssets,
  PARTICIPATION_WINDOW_DAYS,
  type ParticipationInput,
} from "./participation-stats";

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
): ParticipationInput {
  const recap: RecapData = {
    sessions: [],
    contexts: [],
    contextCreates: [],
    canvasElementCreates: [],
    canvasEdgeCreates: [],
    canvasReferencedUnderstandingIds: [],
    ...overrides.recap,
  };
  return {
    understandings: (overrides.understandings ?? []) as ParticipationInput["understandings"],
    canvases: (overrides.canvases ?? []) as ParticipationInput["canvases"],
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

describe("参与概览统计", () => {
  test("空输入：热力图覆盖完整窗口（365 天首尾正确），资产归零", () => {
    const { days, details } = buildParticipationActivity(input(), NOW);
    const assets = computeParticipationAssets(input());

    expect(days).toHaveLength(PARTICIPATION_WINDOW_DAYS);
    expect(days[0]?.date).toBe("2025-06-19");
    expect(days.at(-1)?.date).toBe("2026-06-18");
    expect(days.every((day) => day.count === 0 && day.level === 0)).toBe(true);
    expect(details.size).toBe(0);

    expect(assets.understanding).toBe(0);
    expect(assets.canvas).toBe(0);
    expect(assets.context).toBe(0);
  });

  test("按日细分：对话（会话数/消息数）与创建资产分开计", () => {
    const { days, details } = buildParticipationActivity(
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

    const monday = days.find((day) => day.date === "2026-06-15")!;
    const detail = details.get("2026-06-15")!;
    expect(detail.conversations).toBe(1);
    expect(detail.messages).toBe(3);
    // 创建明细：理解 1 + 画布 1 + 上下文 1，元素/连线 0
    expect(detail.understandingCreated).toBe(1);
    expect(detail.canvasCreated).toBe(1);
    expect(detail.contextCreated).toBe(1);
    expect(detail.canvasElementCreated).toBe(0);
    expect(detail.canvasEdgeCreated).toBe(0);
    // 档位按 对话 + 全部创建 = 4 → 2 档
    expect(monday.count).toBe(4);
    expect(monday.level).toBe(2);
  });

  test("资产指标：三类资产累计存量（无期内新增口径）", () => {
    const assets = computeParticipationAssets(
      input({
        understandings: [
          understanding({ id: "old", createdAt: "2026-06-01T00:00:00.000Z" }),
          understanding({ id: "recent", createdAt: "2026-06-15T00:00:00.000Z" }),
        ],
        canvases: [canvas({ id: "c1", createdAt: "2026-06-15T00:00:00.000Z" })],
        recap: { contextCreates: ["2026-06-01T00:00:00.000Z"] },
      }),
    );

    expect(assets.understanding).toBe(2);
    expect(assets.canvas).toBe(1);
    expect(assets.context).toBe(1);
  });

  test("窗口边界：起点为今天向前 364 天，窗口外（起点之前/未来）不产生格子", () => {
    const { days, details } = buildParticipationActivity(
      input({
        recap: {
          sessions: [session({ sessionId: "before", createdAt: "2025-06-18T08:00:00.000Z" })],
          contextCreates: ["2026-06-19T00:00:00.000Z"], // 明天 → 未来
        },
      }),
      NOW,
    );

    expect(days).toHaveLength(PARTICIPATION_WINDOW_DAYS);
    // 起点前一天不参与
    expect(days.some((day) => day.date === "2025-06-18")).toBe(false);
    // 未来一天不参与
    expect(days.some((day) => day.date === "2026-06-19")).toBe(false);
    expect(details.has("2025-06-18")).toBe(false);
    expect(details.has("2026-06-19")).toBe(false);
  });
});
