import { expect, type Page } from "@playwright/test";

/** 打开画布模块（rail 入口；已在画布模块时直接等待可见）。 */
export async function openCanvasPage(page: Page) {
  await expect(page.getByTestId("capture-page").or(page.getByTestId("canvas-page"))).toBeVisible();
  const canvasPage = page.getByTestId("canvas-page");
  await expect(async () => {
    if (await canvasPage.isVisible()) return;
    await page.getByTestId("app-nav-module-canvas").click();
    await expect(canvasPage).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 15_000 });
}

export function canvasRow(page: Page, title: string) {
  return page.locator(`[data-testid="canvas-list-row"][data-canvas-title="${title}"]`);
}

export function canvasRowMenu(page: Page, title: string) {
  return canvasRow(page, title).locator('[data-testid="canvas-row-menu"]');
}

/** 新建画布（默认标题「未命名画布」）并返回列表。 */
export async function createCanvas(page: Page) {
  await page.getByTestId("canvas-create-button").click();
  await expect(page.getByTestId("canvas-entry-page")).toBeVisible();
  await page.getByTestId("canvas-entry-back-button").click();
  await expect(page.getByTestId("canvas-page")).toBeVisible();
}

/** 通过行 kebab 菜单重命名画布。 */
export async function renameCanvas(page: Page, fromTitle: string, toTitle: string) {
  await canvasRowMenu(page, fromTitle).click();
  await page.getByTestId("canvas-row-rename").click();
  await page.getByTestId("canvas-rename-input").fill(toTitle);
  await page.getByTestId("canvas-rename-confirm-button").click();
  await expect(canvasRow(page, toTitle)).toBeVisible();
}

/** 对画布发起删除，返回确认框按钮定位器（confirm 为真时点击「删除」，否则点击「取消」）。 */
export async function requestDeleteCanvas(page: Page, title: string, confirm: boolean) {
  await canvasRowMenu(page, title).click();
  await page.getByTestId("canvas-row-delete").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: confirm ? "删除" : "取消" }).click();
}
