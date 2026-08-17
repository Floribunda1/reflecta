import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  assistantMessage,
  seedAgentThread,
  seedUnderstanding,
  userMessage,
} from "../agent/agent-fixtures";
import { openRecapPage, todayHeatmapCell } from "./recap-e2e";

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

    // 过程数据：参与热力图
    await expect(page.getByRole("heading", { name: "参与热力图" })).toBeVisible();

    // 已沉淀资产：理解总数 1，且今天创建 → 期内新增 1
    await expect(page.getByTestId("recap-assets")).toBeVisible();
    await expect(page.locator('[data-stat="理解"]')).toHaveText("1");
    await expect(page.getByTestId("recap-assets")).toContainText("期内 +1");

    // 今日对话在热力图中可见（今天开始且有消息的会话）
    await expect(page.getByTestId("recap-participation")).toContainText("对话 1 次");
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

    await page.getByRole("tab", { name: "近一月" }).click();
    await expect(page.getByRole("heading", { name: "参与热力图" })).toBeVisible();
    // 今天创建的理解在 30 天窗口内 → 期内新增仍为 1
    await expect(page.locator('[data-stat="理解"]')).toHaveText("1");
    await expect(page.getByTestId("recap-assets")).toContainText("期内 +1");
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

    await todayHeatmapCell(page).click();
    await expect(page.getByText("热力图回看理解")).toBeVisible();
  } finally {
    await app.close();
  }
});
