import { expect, type Locator, type Page } from "@playwright/test";
import { canvasRow, openCanvasPage } from "../../acceptance/spec/canvas/canvas-e2e";

/**
 * Canvas 集成测试 helper（X6 架构）。
 * 复用 acceptance 的 launchApp / seedCanvas / canvas-e2e 共享基建。
 * 节点按 `data-node-id`（卡片根元素）定位；边用 `.x6-edge`（单边夹具下按序定位）。
 */

/** 从工作区返回画布列表（rail 模块入口；旧 canvas-workspace-back-button 已不存在）。 */
export async function leaveCanvasWorkspace(page: Page) {
  await page.getByTestId("app-nav-module-canvas").click();
  await expect(page.getByTestId("canvas-page")).toBeVisible();
}

/** 进入列表页并打开指定标题的 seed 画布工作区。 */
export async function openSeededCanvas(page: Page, title: string) {
  await openCanvasPage(page);
  await canvasRow(page, title).click();
  await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  await expect(page.getByTestId("canvas-graph")).toBeVisible();
}

/** 主图内按 `data-node-id` 定位节点卡片根。 */
export function nodeInGraph(page: Page, elementId: string): Locator {
  return page.getByTestId("canvas-graph").locator(`[data-node-id="${elementId}"]`);
}

/** 主图内全部边视图（X6 `.x6-edge`）。 */
export function edgesInGraph(page: Page): Locator {
  return page.getByTestId("canvas-graph").locator(".x6-edge");
}

/** 主图内边可见路径（点击选中 / 样式断言用）。 */
export function edgePathInGraph(page: Page): Locator {
  return page.getByTestId("canvas-graph").locator(".x6-edge .connection");
}

/** 方框选（左键拖拽 rubberband）：覆盖给定框集合外扩一定边距。 */
export async function boxSelect(
  page: Page,
  boxes: Array<{ x: number; y: number; width: number; height: number }>,
) {
  const x0 = Math.min(...boxes.map((b) => b.x)) - 40;
  const y0 = Math.min(...boxes.map((b) => b.y)) - 40;
  const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + 40;
  const y1 = Math.max(...boxes.map((b) => b.y + b.height)) + 40;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** 计算一组节点当前屏幕框（供框选 / 位置断言）。 */
export async function nodeBoxes(page: Page, ids: string[]) {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (const id of ids) {
    boxes.push((await nodeInGraph(page, id).boundingBox())!);
  }
  return boxes;
}

/** 选中一条边：点击主图第一条 `.x6-edge` 的包围盒中心（3.x 边路径无 class，点透明交互路径）。 */
export async function selectEdge(page: Page) {
  const edge = page.getByTestId("canvas-graph").locator(".x6-edge").first();
  const box = (await edge.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
}

/** 打开理解库侧栏。 */
export async function openLibrary(page: Page) {
  await page.getByTestId("canvas-toggle-library-button").click();
  await expect(page.getByTestId("canvas-library-panel")).toBeVisible();
}

/** 用 X6 Dnd 从源（onPointerDown 会调 startDrag 的按钮/条目）拖到目标画布坐标。 */
export async function dragSourceTo(page: Page, source: Locator, x: number, y: number) {
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
