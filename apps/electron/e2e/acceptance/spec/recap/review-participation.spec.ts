import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  assistantMessage,
  seedAgentThread,
  seedUnderstanding,
  userMessage,
} from "../agent/agent-fixtures";
import { heatmapCell, openRecapPage, todayDateKey, RECAP_HEATMAP_DAY_COUNT } from "./recap-e2e";

test("@RECAP-001 用户打开回顾页看到过程数据与沉淀资产", async () => {
  const now = Date.now();
  seedUnderstanding({
    id: "recap-understanding",
    title: "回顾页验收理解",
    body: "用于验收回顾页资产计数",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  seedAgentThread({
    id: "recap-thread",
    title: "回顾页验收对话",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    messages: [
      userMessage("recap-user-1", "今天聊了什么"),
      assistantMessage("recap-assistant-1", [{ type: "text", text: "正在整理理解" }]),
    ],
  });
  const { app, page } = await launchApp();

  try {
    await openRecapPage(page);

    // 过程数据：参与热力图始终覆盖完整时间范围（365 天），不做时间范围筛选
    const heatmap = page.getByTestId("recap-heatmap");
    await expect(heatmap.locator("rect[data-date]").first()).toBeVisible();
    await expect(heatmap.locator("rect[data-date]")).toHaveCount(RECAP_HEATMAP_DAY_COUNT);

    // hover 细分：今天格子带细分 title（对话 1 次 · 消息 1 条 · 沉淀资产 1 个）
    const todayCell = heatmapCell(page, todayDateKey());
    await expect(todayCell).toHaveAttribute("title", /对话 1 次/);

    // 已沉淀资产：理解总数含今天创建的理解（无期间筛选口径）
    await expect(page.getByTestId("recap-assets")).toBeVisible();
    await expect(page.locator('[data-stat="理解"]')).not.toHaveText("0");
  } finally {
    await app.close();
  }
});

test("@RECAP-002 用户打开回顾页看到资产累计趋势", async () => {
  const now = Date.now();
  seedUnderstanding({
    id: "recap-understanding-trend",
    title: "累计趋势验收理解",
    body: "用于验收资产累计趋势曲线图",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  const { app, page } = await launchApp();

  try {
    await openRecapPage(page);

    // 资产累计趋势：三类资产曲线图始终展示（不随筛选变化），图例含 理解/画布/上下文
    const trend = page.getByTestId("recap-trend-card");
    await expect(trend).toBeVisible();
    await expect(trend.getByText("理解", { exact: true })).toBeVisible();
    await expect(trend.getByText("画布", { exact: true })).toBeVisible();
    await expect(trend.getByText("上下文", { exact: true })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@RECAP-003 用户点击热力图某天回看当天参与记录", async () => {
  const now = Date.now();
  seedUnderstanding({
    id: "recap-understanding-2",
    title: "热力图回看理解",
    body: "用于验收点击热力图回看当天明细",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  const { app, page } = await launchApp();

  try {
    await openRecapPage(page);

    await heatmapCell(page, todayDateKey()).click();
    await expect(page.getByText("热力图回看理解")).toBeVisible();
  } finally {
    await app.close();
  }
});
