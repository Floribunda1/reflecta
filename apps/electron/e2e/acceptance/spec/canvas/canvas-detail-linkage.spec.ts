import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { dragLocatorToGraph, inGraph, openCanvasPage, openWorkspace } from "./canvas-e2e";

/** 在一个新建画布上拖入 RSC 理解卡 */
async function dropUnderstandingCard(page: import("@playwright/test").Page) {
  await openWorkspace(page);
  await page.getByTestId("canvas-toggle-library-button").click();
  await expect(page.getByTestId("canvas-library-panel")).toBeVisible();
  const rsc = page.locator(
    '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]',
  );
  await expect(rsc).toBeVisible();
  await dragLocatorToGraph(page, rsc, { x: 200, y: 120 });
  const card = inGraph(page, "canvas-understanding-card");
  await expect(card).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1400); // 等保存 + 引用刷新
  return card;
}

test("@CV-DETAIL-001 用户点击画布理解卡进入详情", async () => {
  const { app, page } = await launchApp();

  try {
    const card = await dropUnderstandingCard(page);
    await card.click();
    await expect(page.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
    );
  } finally {
    await app.close();
  }
});

test("@CV-DETAIL-002 用户在详情编辑保存后画布卡同步", async () => {
  const { app, page } = await launchApp();

  try {
    const card = await dropUnderstandingCard(page);
    await card.click();
    await expect(page.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });

    const titleInput = page.getByPlaceholder("写下一个刚形成的理解");
    await titleInput.fill("UPDATED_UNDERSTANDING_TITLE");
    await titleInput.blur();
    await page.waitForTimeout(1600); // 详情保存 → 画布 detail 失效刷新

    await expect(inGraph(page, "canvas-understanding-card")).toContainText(
      "UPDATED_UNDERSTANDING_TITLE",
    );
  } finally {
    await app.close();
  }
});

test("@CV-DETAIL-003 库与详情互斥", async () => {
  const { app, page } = await launchApp();

  try {
    const card = await dropUnderstandingCard(page);
    // 此时库面板仍开着；点击理解卡 → 详情替代库
    await expect(page.getByTestId("canvas-library-panel")).toBeVisible();
    await card.click();
    await expect(page.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("canvas-library-panel")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CV-DETAIL-004 用户关闭详情面板恢复全宽", async () => {
  const { app, page } = await launchApp();

  try {
    const card = await dropUnderstandingCard(page);
    await card.click();
    await expect(page.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("canvas-detail-panel").getByLabel("关闭详情").click();
    await expect(page.getByTestId("canvas-detail-panel")).toHaveCount(0);
    await expect(page.getByTestId("canvas-graph")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-DETAIL-005 用户在 Capture 详情看到画布归属并跳转", async () => {
  const { app, page } = await launchApp();

  try {
    // 让 RSC 属于一张画布
    await openCanvasPage(page);
    await page.getByTestId("canvas-create-button").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    const library = page.getByTestId("canvas-library-panel");
    if ((await library.count()) === 0) {
      await page.getByTestId("canvas-toggle-library-button").click();
      await expect(library).toBeVisible();
    }
    const rsc = page.locator(
      '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]',
    );
    await expect(rsc).toBeVisible();
    await dragLocatorToGraph(page, rsc, { x: 200, y: 120 });
    await expect(inGraph(page, "canvas-understanding-card")).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1600);

    // 回 Capture 打开该理解详情 → 画布归属区块
    await page.getByTestId("app-nav-module-capture").click();
    await expect(page.getByTestId("capture-page")).toBeVisible();
    await page
      .getByTestId("capture-understanding-card")
      .filter({ hasText: "React Server Components" })
      .first()
      .click();
    const membership = page.getByTestId("capture-understanding-canvas").first();
    await expect(membership).toBeVisible({ timeout: 8000 });

    // 点击画布 → 跳转画布模块
    await membership.click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  } finally {
    await app.close();
  }
});
