import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { seedUnderstanding } from "../agent/agent-fixtures";
import { domainNode, openCapturePage, understandingCard } from "./capture-e2e";

test("@CP-LIST-005 用户打开 Dashboard 看到最近更新的 Understanding 在前", async () => {
  seedUnderstanding({
    id: "sort-old-created",
    title: "较早创建但最近更新",
    body: "用于验收更新时间排序",
    createdAt: "2029-01-01T00:00:00.000Z",
    updatedAt: "2031-01-01T00:00:00.000Z",
  });
  seedUnderstanding({
    id: "sort-new-created",
    title: "最近创建但较早更新",
    body: "用于验收创建时间排序",
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await expect(page.getByTestId("capture-understanding-card").first()).toHaveAttribute(
      "data-understanding-title",
      "较早创建但最近更新",
    );
  } finally {
    await app.close();
  }
});

test("@CP-LIST-002 用户选择 Domain 后只看到当前领域中的 Understanding", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    const allCards = await page.getByTestId("capture-understanding-card").count();
    await domainNode(page, "Programming").click();

    await expect(page.getByTestId("capture-understanding-card").first()).toBeVisible();
    await expect
      .poll(async () => page.getByTestId("capture-understanding-card").count())
      .toBeLessThan(allCards);
  } finally {
    await app.close();
  }
});

test("@CP-LIST-004 用户搜索关键词并清空恢复", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await page.getByPlaceholder("查找已有理解").fill("Server Components");

    await expect(understandingCard(page, "React Server Components")).toBeVisible();

    await page.getByPlaceholder("查找已有理解").fill("");
    await expect(understandingCard(page, "React Server Components")).toBeVisible();
    await expect(page.getByTestId("capture-understanding-card").first()).toBeVisible();
  } finally {
    await app.close();
  }
});
