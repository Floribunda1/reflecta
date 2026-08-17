import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  assistantMessage,
  seedAgentThread,
  seedUnderstanding,
  userMessage,
} from "../agent/agent-fixtures";
import { openRecapPage, todayHeatmapCell } from "./recap-e2e";

test("@RECAP-001 用户打开回顾页看到今日参与与资产计数", async () => {
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

    // 参与区块：今日对话 / 今日消息 / 今日沉淀动作
    await expect(page.getByTestId("recap-participation")).toBeVisible();
    await expect(page.getByRole("heading", { name: "近 12 周参与" })).toBeVisible();

    // 资产区块：今天的理解数量为 1
    await expect(page.getByTestId("recap-assets")).toBeVisible();
    await expect(page.locator('[data-stat="理解"]')).toHaveText("1");

    // 今日参与非空（seed 会话与理解都发生在今天）
    await expect(page.locator('[data-stat="今日对话"]')).not.toHaveText("0");
  } finally {
    await app.close();
  }
});

test("@RECAP-002 用户点击热力图某天回看当天参与记录", async () => {
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
