import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  assistantMessage,
  seedAgentThread,
  seedUnderstanding,
  userMessage,
} from "../agent/agent-fixtures";
import { heatmapCell, openRecapPage, todayDateKey } from "./recap-e2e";

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

    // 过程数据：参与热力图（带月/周标注的日历网格，整周对齐补全，窗口内天数带 data-date）
    const heatmap = page.getByTestId("recap-heatmap");
    await expect(heatmap.locator("rect[data-date]").first()).toBeVisible();
    await expect(heatmap.locator("rect[data-date]")).toHaveCount(7); // 本周 = 7 天

    // hover 细分：今天格子带细分 title（对话 1 次 · 消息 1 条 · 沉淀资产 1 个）
    const todayCell = heatmapCell(page, todayDateKey());
    await expect(todayCell).toHaveAttribute("title", /对话 1 次/);

    // 已沉淀资产：双显示 —— 今天创建的理解计入期内新增 +1（总量含全局 seed）
    await expect(page.getByTestId("recap-assets")).toBeVisible();
    await expect(page.locator('[data-stat="理解"]')).not.toHaveText("0");
    await expect(page.getByTestId("recap-assets")).toContainText("期内 +1");
  } finally {
    await app.close();
  }
});

test("@RECAP-002 用户切换时间范围筛选", async () => {
  const now = Date.now();
  seedUnderstanding({
    id: "recap-understanding-period",
    title: "时间范围验收理解",
    body: "用于验收 period 筛选",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  const { app, page } = await launchApp();

  try {
    await openRecapPage(page);

    const heatmap = page.getByTestId("recap-heatmap");
    await expect(heatmap.locator("rect[data-date]").first()).toBeVisible();

    await page.getByRole("tab", { name: "近一月" }).click();
    await expect(heatmap.locator("rect[data-date]")).toHaveCount(30); // 近一月 = 30 天

    // 今天创建的理解在 30 天窗口内 → 资产区显示期内新增标记（seed 环境本月另有存量）
    await expect(page.locator('[data-stat="理解"]')).not.toHaveText("0");
    await expect(page.getByTestId("recap-assets")).toContainText("期内 +");
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
