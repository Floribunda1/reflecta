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
  await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  await page.getByTestId("canvas-workspace-back-button").click();
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

/** 进入新建画布的工作区。 */
export async function openWorkspace(page: Page) {
  await openCanvasPage(page);
  await createCanvas(page);
  await canvasRow(page, "未命名画布").click();
  await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  await page.waitForTimeout(300);
}

/**
 * 基于 HTML5 drag 的拖入（工具栏 / 库面板 draggable → 画布 onDrop 落点）。
 * 支持任意源定位器（index 用于多实例源）。
 */
export async function dragLocatorToGraph(
  page: Page,
  source: ReturnType<Page["getByTestId"]>,
  targetPosition: { x: number; y: number },
) {
  const graph = page.getByTestId("canvas-graph");
  await source.dragTo(graph, { targetPosition });
  await page.waitForTimeout(200);
}

export async function dragToGraph(
  page: Page,
  sourceTestId: string,
  targetPosition: { x: number; y: number },
  index = 0,
) {
  await dragLocatorToGraph(page, page.getByTestId(sourceTestId).nth(index), targetPosition);
}

/** 主图内的元素定位（Minimap 源图克隆会重复渲染一份，断言需限定主图）。 */
export function inGraph(page: Page, testId: string) {
  return page.getByTestId("canvas-graph").getByTestId(testId);
}

/** 等待防抖持久化（saveCanvas 800ms + 提交余量）落库。 */
export async function waitForCanvasSave(page: Page, ms = 1400) {
  await page.waitForTimeout(ms);
}

/** 离开工作区返回列表（触发卸载冲刷保存）。 */
export async function leaveWorkspace(page: Page) {
  await page.getByTestId("canvas-workspace-back-button").click();
  await expect(page.getByTestId("canvas-page")).toBeVisible();
}

/** 重新进入第一张「未命名画布」的工作区。 */
export async function reopenWorkspace(page: Page) {
  await canvasRow(page, "未命名画布").first().click();
  await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  await page.waitForTimeout(500);
}

/** 主图视口（React Flow viewport）的 transform，用于缩放 / 平移断言。 */
export function graphViewportTransform(page: Page) {
  return page.getByTestId("canvas-graph").locator(".react-flow__viewport");
}

/** 主图内第一个节点的位置（React Flow 用 CSS transform，改用边界框坐标）。 */
export async function firstNodeTransform(page: Page) {
  const box = await page
    .getByTestId("canvas-graph")
    .locator(".react-flow__node")
    .first()
    .boundingBox();
  return box ? `${Math.round(box.x)},${Math.round(box.y)}` : null;
}
