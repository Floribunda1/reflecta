import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  assistantMessage,
  seedAgentThread,
  seedCanvas,
  seedContext,
  seedUnderstanding,
  userMessage,
} from "../agent/agent-fixtures";
import {
  openCapturePage,
  participationHeatmapCell,
  PARTICIPATION_HEATMAP_DAY_COUNT,
  todayDateKey,
} from "./capture-e2e";

test("@CP-OVERVIEW-001 用户打开捕获页看到足迹热力图与资产数量", async () => {
  const now = Date.now();
  seedUnderstanding({
    id: "participation-understanding",
    title: "足迹验收理解",
    body: "用于验收捕获页顶部足迹",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  seedAgentThread({
    id: "participation-thread",
    title: "足迹验收对话",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    messages: [
      userMessage("participation-user-1", "今天聊了什么"),
      assistantMessage("participation-assistant-1", [{ type: "text", text: "正在整理理解" }]),
    ],
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);

    const overview = page.getByTestId("participation-overview");
    await expect(overview).toBeVisible();

    const heatmap = page.getByTestId("participation-heatmap");
    await expect(heatmap.locator("rect[data-date]").first()).toBeVisible();
    await expect(heatmap.locator("rect[data-date]")).toHaveCount(PARTICIPATION_HEATMAP_DAY_COUNT);
    await expect(overview.locator('[data-stat="理解"]')).not.toHaveText("0");
    await expect(overview.getByText("画布", { exact: true })).toBeVisible();
    await expect(overview.getByText("上下文", { exact: true })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-OVERVIEW-002 用户悬停热力图某天查看当天细分", async () => {
  const now = Date.now();
  seedUnderstanding({
    id: "participation-understanding-hover",
    title: "足迹悬停理解",
    body: "用于验收足迹热力图悬停细分",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  seedAgentThread({
    id: "participation-thread-hover",
    title: "参与概览悬停对话",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    messages: [
      userMessage("participation-user-2", "今天聊了什么"),
      assistantMessage("participation-assistant-2", [{ type: "text", text: "正在整理理解" }]),
    ],
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);

    // 悬停细分：今天格子带细分 title（对话 1 次 · 消息 1 条 · 沉淀资产 ≥1 个）
    const todayCell = participationHeatmapCell(page, todayDateKey());
    await expect(todayCell).toHaveAttribute("title", /对话 1 次/);
    await expect(todayCell).toHaveAttribute("title", /消息 1 条/);
  } finally {
    await app.close();
  }
});

test("@CP-OVERVIEW-003 用户点击热力图某天回看当天足迹", async () => {
  const now = Date.now();
  seedUnderstanding({
    id: "participation-understanding-2",
    title: "足迹回看理解",
    body: "用于验收点击足迹热力图回看当天明细",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  seedContext({
    id: "participation-context-day",
    understandingId: "participation-understanding-2",
    title: "足迹回看上下文",
    content: "当天沉淀的一条上下文",
  });
  seedCanvas({
    id: "participation-canvas-day",
    title: "足迹回看画布",
    createdAt: new Date(now).toISOString(),
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);

    await participationHeatmapCell(page, todayDateKey()).click();
    const popover = page.getByTestId("participation-day-popover");
    await expect(popover).toBeVisible();
    await expect(popover.getByText("足迹回看理解", { exact: true })).toBeVisible();
    await expect(popover.getByText("足迹回看上下文", { exact: true })).toBeVisible();
    await expect(popover.getByText("足迹回看画布", { exact: true })).toBeVisible();
  } finally {
    await app.close();
  }
});
