import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { seedUnderstanding } from "../agent/agent-fixtures";
import { domainNode, openCapturePage, understandingRow } from "./capture-e2e";

function understandingCount(page: Page) {
  return page
    .getByTestId("capture-understanding-list-header")
    .locator("div")
    .filter({ hasText: /^\d+(?: \/ \d+)? 条理解$/ })
    .first();
}

test("@CP-LIST-005 用户按更新时间或创建时间排序", async () => {
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
    const firstRow = page.getByTestId("capture-understanding-row").first();
    await expect(firstRow).toHaveAttribute("data-understanding-title", "较早创建但最近更新");

    await page.getByRole("button", { name: "排序理解" }).click();
    await page.getByRole("menuitemradio", { name: "按创建时间" }).click();
    await expect(firstRow).toHaveAttribute("data-understanding-title", "最近创建但较早更新");
  } finally {
    await app.close();
  }
});

test("@CP-LIST-002 用户选择 Domain 后只看到当前领域中的 Understanding", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    const allCount = await understandingCount(page).textContent();
    await domainNode(page, "Programming").click();

    await expect(page.getByTestId("capture-understanding-list-header")).toContainText(
      "Programming",
    );
    await expect(understandingCount(page)).not.toHaveText(allCount ?? "");
    await expect(page.getByTestId("capture-understanding-row").first()).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-LIST-003 用户决定是否包含子 Domain 的 Understanding", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();
    const withDescendants = await understandingCount(page).textContent();

    await page.getByRole("button", { name: "已包含子领域" }).click();
    const directOnly = await understandingCount(page).textContent();
    expect(Number.parseInt(directOnly ?? "0", 10)).toBeLessThan(
      Number.parseInt(withDescendants ?? "0", 10),
    );

    await page.getByRole("button", { name: "未包含子领域" }).click();
    await expect(understandingCount(page)).toHaveText(withDescendants ?? "");
  } finally {
    await app.close();
  }
});

test("@CP-LIST-004 用户在当前 Domain 中搜索并清空关键词", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await page.getByRole("button", { name: "搜索理解" }).click();
    await page.getByPlaceholder("查找已有理解").fill("React Server Components");

    await expect(understandingRow(page, "React Server Components")).toBeVisible();
    await expect(understandingCount(page)).toContainText("/");

    await page.getByRole("button", { name: "收起搜索" }).click();
    await expect(page.getByPlaceholder("查找已有理解")).toHaveCount(0);
    await expect(understandingCount(page)).not.toContainText("/");
  } finally {
    await app.close();
  }
});

test("@CP-LIST-001 用户调整 Understanding 列表宽度", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    const listPanel = page.getByTestId("capture-understanding-list-panel");
    const detailPanel = page.getByTestId("capture-understanding-detail-panel");
    const handleBox = await page
      .getByTestId("capture-understanding-list-resize-handle")
      .boundingBox();
    const initialBox = await listPanel.boundingBox();
    if (!handleBox || !initialBox)
      throw new Error("Understanding list resize handle is not visible");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2, { steps: 8 });
    await expect
      .poll(async () => (await listPanel.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialBox.width + 70);
    await page.mouse.up();
    await expect(detailPanel).toBeVisible();
  } finally {
    await page.mouse.up().catch(() => undefined);
    await app.close();
  }
});
