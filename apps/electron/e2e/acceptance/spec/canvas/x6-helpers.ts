import { expect, type Locator, type Page } from "@playwright/test";
import { canvasRow, openCanvasPage } from "./canvas-e2e";

/* ---------- 画布共享辅助（X6 验收用；单 app 实例内多场景串行复用） ---------- */

/** 进入画布列表并打开指定标题的画布工作区。 */
export async function openCanvasRow(page: Page, title: string) {
  await openCanvasPage(page);
  await canvasRow(page, title).click();
  await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  await page.waitForTimeout(350);
}

/** 主图内按 data-node-id 定位卡片根。 */
export function nodeInGraph(page: Page, elementId: string): Locator {
  return page.getByTestId("canvas-graph").locator(`[data-node-id="${elementId}"]`);
}

/** 主图内全部边视图。 */
export function edgesInGraph(page: Page): Locator {
  return page.getByTestId("canvas-graph").locator(".x6-edge");
}

/** 主图节点数。 */
export const graphNodeCount = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __x6graph?: { getNodes(): unknown[] } }).__x6graph?.getNodes()
        .length ?? -1,
  );

/** 图中节点位置 / 尺寸。 */
export async function nodeGeometry(page: Page, id: string) {
  return page.evaluate((id) => {
    const graph = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    const node = graph?.getCellById(id);
    if (!node?.isNode()) return null;
    const p = node.position();
    const s = node.size();
    return { x: p.x, y: p.y, width: s.width, height: s.height };
  }, id);
}

/** 连线两端连接的节点（模型层：用于断言重排 / 避让后连接关系不变）。 */
export async function edgeTerminals(page: Page, edgeId: string) {
  return page.evaluate((id) => {
    const graph = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    const edge = graph?.getCellById(id);
    if (!edge?.isEdge()) return null;
    return { source: edge.getSourceCellId(), target: edge.getTargetCellId() };
  }, edgeId);
}

/** X6 原生 port magnet 的屏幕中心。 */
export async function portCenter(page: Page, nodeId: string, portId: string) {
  return page.evaluate(
    ({ nodeId, portId }) => {
      const graph = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
      const node = graph?.getCellById(nodeId);
      if (!graph || !node) return null;
      const view = graph.findViewByCell(node) as unknown as {
        findPortElem(id: string): Element | null;
      };
      const port = view.findPortElem(portId);
      if (!port) return null;
      const box = port.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    },
    { nodeId, portId },
  );
}

/** 等待主图挂载并可读视口（防止 reopen 后图未就绪读到 null）。 */
export async function waitViewport(page: Page) {
  await expect
    .poll(async () => (await graphViewport(page)) !== null, { timeout: 8000, intervals: [150] })
    .toBe(true);
  return graphViewport(page);
}

/** 视口（平移 + 缩放）。 */
export async function graphViewport(page: Page) {
  return page.evaluate(() => {
    const graph = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    if (!graph) return null;
    // X6 3.x：translate() 无参时返回 { tx, ty }
    const t = graph.translate() as unknown as { tx: number; ty: number };
    return { x: t.tx, y: t.ty, zoom: graph.zoom() };
  });
}

/** 节点屏幕框集合（供框选）。 */
export async function nodeBoxes(page: Page, ids: string[]) {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (const id of ids) boxes.push((await nodeInGraph(page, id).first().boundingBox())!);
  return boxes;
}

/** 左键拖拽框选（rubberband）：覆盖给定框集合外扩边距。 */
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

/** X6 Dnd 拖拽：源（onMouseDown → startDrag 的按钮/条目）拖到目标画布坐标。 */
export async function dragSourceTo(page: Page, source: Locator, x: number, y: number) {
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

/** 真实 mouse 拖动平移节点。 */
export async function dragNodeBy(page: Page, id: string, dx: number, dy: number) {
  const box = (await nodeInGraph(page, id).first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** 边路径中点（屏幕坐标），供选中 / 双击复用。 */
async function edgeMidpoint(page: Page): Promise<{ x: number; y: number } | null> {
  const edge = edgesInGraph(page).first();
  return edge.evaluate((el) => {
    const paths = [...el.querySelectorAll("path")].filter((p) => p.getTotalLength?.() > 10);
    // X6 边点击命中层是加粗透明 interaction path：按 stroke-width 降序取最粗的一条
    const line = paths
      .map((p) => ({ p, w: parseFloat(p.getAttribute("stroke-width") ?? "0") }))
      .sort((l, r) => r.w - l.w)[0]?.p;
    if (!line) return null;
    try {
      const p = line.getPointAtLength(line.getTotalLength() / 2) as DOMPoint;
      const ctm = (line.getScreenCTM?.() ?? null) as DOMMatrix | null;
      if (!ctm) return null;
      const screen = p.matrixTransform(ctm);
      return { x: screen.x, y: screen.y };
    } catch {
      return null;
    }
  });
}

/** 指定目标边的 SVG 路径终点（屏幕坐标），用于校验箭头与连接桩的轴向对齐。 */
export async function edgeEndpoint(page: Page, targetId: string) {
  return page.evaluate((id) => {
    const graph = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    const edge = graph?.getEdges().find((item) => item.getTargetCellId() === id);
    const view = edge ? graph?.findViewByCell(edge) : null;
    const paths = Array.from(view?.container.querySelectorAll("path") ?? []);
    const line = paths
      .map((path) => ({ path, width: parseFloat(path.getAttribute("stroke-width") ?? "0") }))
      .sort((left, right) => right.width - left.width)[0]?.path;
    if (!line) return null;
    const point = line.getPointAtLength(line.getTotalLength());
    const matrix = line.getScreenCTM();
    if (!matrix) return null;
    const screen = point.matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  }, targetId);
}

/** 单击选中第一条边（点路径中点，避开节点/端桩）。 */
export async function selectEdge(page: Page) {
  const point = await edgeMidpoint(page);
  if (point) await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
}

/** 第一条边路径中点（屏幕坐标），右键菜单等场景复用。 */
export async function edgeMidpointScreen(page: Page): Promise<{ x: number; y: number } | null> {
  return edgeMidpoint(page);
}

/** 双击第一条边的路径中点（就地编辑标签）。 */
export async function dblclickEdge(page: Page) {
  const point = await edgeMidpoint(page);
  if (point) await page.mouse.dblclick(point.x, point.y);
  await page.waitForTimeout(200);
}

/** 边模型探针：每条边的 DTO / connector / 样式 attrs。 */
export async function edgeModel(page: Page) {
  return page.evaluate(() => {
    const graph = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    if (!graph) return [];
    return graph.getEdges().map((edge) => {
      const line = (edge.getAttrs() as { line?: Record<string, unknown> })?.line ?? {};
      const dto = (edge.getData() as { edge?: Record<string, unknown> } | null)?.edge ?? {};
      return {
        id: edge.id,
        canvasId: dto.canvasId ?? null,
        source: edge.getSourceCellId() ?? null,
        sourcePort: edge.getSourcePortId() ?? null,
        target: edge.getTargetCellId() ?? null,
        targetPort: edge.getTargetPortId() ?? null,
        label: dto.label ?? null,
        attrs: dto.attrs,
        router: edge.getRouter()?.name ?? null,
        routerArgs: edge.getRouter()?.args ?? null,
        connector: edge.getConnector()?.name ?? null,
        strokeToken: line.stroke ?? null,
        dasharray: line.strokeDasharray ?? null,
        strokeWidth: line.strokeWidth ?? null,
        marker: line.targetMarker?.name ?? null,
      };
    });
  });
}

/** 组探针：组 id / 成员 / 父级链（嵌套断言用）。 */
export async function groupTree(page: Page) {
  return page.evaluate(() => {
    const graph = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    if (!graph) return [];
    return graph
      .getNodes()
      .filter((n) => n.shape === "group")
      .map((n) => ({
        id: n.id,
        children: (n.getChildren() ?? []).map((c) => c.id),
        parent: n.getParent()?.id ?? null,
      }));
  });
}

/** 选中一张卡片（点击其中点）。 */
export async function clickNode(page: Page, id: string) {
  const box = (await nodeInGraph(page, id).first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
}

/** 打开理解库。 */
export async function openLibrary(page: Page) {
  await page.getByTestId("canvas-toggle-library-button").click();
  await expect(page.getByTestId("canvas-library-panel")).toBeVisible();
}

/** 当前画布卡片边框渲染色（选中卡片后调色板断言用）。 */
export async function borderColorOf(page: Page, locator: Locator) {
  return locator.first().evaluate((el) => getComputedStyle(el).borderTopColor);
}

/** X6 模型事件转发（[x6] 前缀）：诊断时一行挂上，事件流直接可见，不用贴探针。 */
export async function attachX6Log(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    if (!g || (globalThis as Record<string, unknown>).__x6logAttached) return;
    (globalThis as Record<string, unknown>).__x6logAttached = true;
    const log = (name: string, detail: unknown) =>
      // eslint-disable-next-line no-console
      console.log(`[x6] ${name} ${JSON.stringify(detail)}`);
    g.on("node:change:parent", ({ node, current }) =>
      log("node:change:parent", {
        id: node.id,
        current: (current as { id?: string } | null)?.id ?? null,
      }),
    );
    g.on("node:added", ({ node }) => log("node:added", { id: node.id }));
    g.on("node:removed", ({ node }) => log("node:removed", { id: node.id }));
    g.on("edge:click", ({ edge }) => log("edge:click", { id: edge.id }));
    g.on("cell:click", ({ cell }) =>
      log("cell:click", { id: cell.id, type: cell.isNode() ? "node" : "edge" }),
    );
    g.on("blank:click", () => log("blank:click", {}));
    g.on("node:change:position", ({ node }) => log("node:change:position", { id: node.id }));
    log("parents", () =>
      g
        .getNodes()
        .map((n) => ({ id: n.id, parent: n.getParent()?.id ?? null }))
        .sort((l, r) => l.id.localeCompare(r.id)),
    );
  });
}
