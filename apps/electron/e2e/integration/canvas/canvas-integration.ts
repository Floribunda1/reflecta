import { expect, type Locator, type Page } from "@playwright/test";
import { canvasRow, openCanvasPage } from "../../acceptance/spec/canvas/canvas-e2e";

/**
 * 画布模块集成测试 helper（仅服务于画布本身的 RF 定制逻辑断言）。
 * 复用 acceptance/regression 的共享基建（launchApp / seedCanvas / canvas-e2e helpers），
 * 这里只补充按标题进入 seed 画布、按元素 id 定位节点等模块内定位能力。
 */

/** 进入列表页并打开指定标题的画布工作区（seedCanvas 预置画布）。 */
export async function openSeededCanvas(page: Page, title: string) {
  await openCanvasPage(page);
  await canvasRow(page, title).click();
  await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  await expect(page.getByTestId("canvas-graph")).toBeVisible();
}

/** 主图内按元素 id 定位节点（React Flow 给节点 wrapper 挂了 data-id）。 */
export function nodeInGraph(page: Page, elementId: string): Locator {
  return page.getByTestId("canvas-graph").locator(`.react-flow__node[data-id="${elementId}"]`);
}

/** 主图内全部边 wrapper。 */
export function edgesInGraph(page: Page): Locator {
  return page.getByTestId("canvas-graph").locator(".react-flow__edge");
}

/** 主图内边可见路径（RF 的 .react-flow__edge-path，非 pointer-events 属性）。 */
export function edgeLineInGraph(page: Page): Locator {
  return edgesInGraph(page).locator(".react-flow__edge-path");
}

/** 主图视口 transform 字符串（平移/缩放断言用）。 */
export async function viewportTransform(page: Page): Promise<string | null> {
  return page.getByTestId("canvas-graph").locator(".react-flow__viewport").getAttribute("style");
}

/** 给定屏幕坐标处最顶层元素的 className 链（断言元素是否置顶、不被节点遮挡）。 */
export async function topmostChainAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py);
      if (!el) return "";
      const chain: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.body) {
        const testId = cur.getAttribute?.("data-testid");
        chain.push(testId ?? cur.className?.toString?.() ?? cur.tagName);
        cur = cur.parentElement;
      }
      return chain.join("|");
    },
    [x, y] as [number, number],
  );
}

/** 从卡片 source handle（右缘）拖到另一卡片 target handle（左缘），建立有向边。 */
export async function dragHandleToHandle(page: Page, sourceNode: Locator, targetNode: Locator) {
  await sourceNode
    .locator(".react-flow__handle.source")
    .dragTo(targetNode.locator(".react-flow__handle.target"), { force: true });
}

/** 选中一条边（点击边的 interaction 路径，命中 wrap）。 */
export async function selectEdgeByNodeIds(page: Page, edgeId: string) {
  const interaction = page
    .getByTestId("canvas-graph")
    .locator(`.react-flow__edge[data-id="${edgeId}"] .react-flow__edge-interaction`);
  await interaction.dispatchEvent("click");
  await page.waitForTimeout(150);
  await expect(
    page.getByTestId("canvas-graph").locator(`.react-flow__edge[data-id="${edgeId}"]`),
  ).toHaveClass(/selected/);
}

/** 框选：从左上到右下拖出一个覆盖所有给定节点的矩形。 */
export async function boxSelectNodes(
  page: Page,
  boxes: Array<{ x: number; y: number; width: number; height: number }>,
) {
  const x0 = Math.min(...boxes.map((box) => box.x)) - 40;
  const y0 = Math.min(...boxes.map((box) => box.y)) - 40;
  const x1 = Math.max(...boxes.map((box) => box.x + box.width)) + 40;
  const y1 = Math.max(...boxes.map((box) => box.y + box.height)) + 40;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
