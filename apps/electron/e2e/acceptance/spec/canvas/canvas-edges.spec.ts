import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  dragToGraph,
  inGraph,
  leaveWorkspace,
  openWorkspace,
  reopenWorkspace,
  waitForCanvasSave,
} from "./canvas-e2e";

/** 放两个文本卡并返回它们的包围盒与相关定位器。 */
async function setupTwoCards(page: Parameters<typeof openWorkspace>[0]) {
  await openWorkspace(page);
  await dragToGraph(page, "canvas-tool-dnd-text", { x: 150, y: 120 });
  await expect(inGraph(page, "canvas-text-card").first()).toBeVisible({ timeout: 8000 });
  await dragToGraph(page, "canvas-tool-dnd-text", { x: 520, y: 120 });
  await expect(inGraph(page, "canvas-text-card").nth(1)).toBeVisible({ timeout: 8000 });
  await waitForCanvasSave(page);
  const cards = inGraph(page, "canvas-text-card");
  const boxA = (await cards.nth(0).boundingBox())!;
  const boxB = (await cards.nth(1).boundingBox())!;
  return { cards, boxA, boxB, graph: page.getByTestId("canvas-graph") };
}

/** 从卡片 A 右缘拖到卡片 B 左缘（端口磁吸），建立有向边。 */
async function drawEdge(
  page: Parameters<typeof openWorkspace>[0],
  boxA: { x: number; y: number; width: number; height: number },
  boxB: { x: number; y: number; width: number; height: number },
) {
  await page.mouse.move(boxA.x + boxA.width - 2, boxA.y + boxA.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxB.x + 2, boxB.y + boxB.height / 2, { steps: 15 });
  await page.mouse.up();
}

const edgeIn = (page: Parameters<typeof openWorkspace>[0]) =>
  page.getByTestId("canvas-graph").locator(".x6-edge");

/** 连线可见线（pointer-events:none 的 line 路径）是否已渲染几何。 */
const edgeLine = (page: Parameters<typeof openWorkspace>[0]) =>
  edgeIn(page).locator('path[pointer-events="none"]');

/** 两卡几何中点的连线坐标（命中 wrap 命中路径 / 连线）。 */
function edgeMidpoint(
  boxA: { x: number; y: number; width: number; height: number },
  boxB: { x: number; y: number; width: number; height: number },
) {
  return {
    x: (boxA.x + boxA.width + boxB.x) / 2,
    y: (boxA.y + boxA.height / 2 + boxB.y + boxB.height / 2) / 2,
  };
}

/** 单击连线（几何中点）以选中。 */
async function selectEdge(
  page: Parameters<typeof openWorkspace>[0],
  boxA: { x: number; y: number; width: number; height: number },
  boxB: { x: number; y: number; width: number; height: number },
) {
  const mid = edgeMidpoint(boxA, boxB);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(250);
}

test.describe("连线（M4）", () => {
  test("@CV-EDGE-001 从卡片拖出有向连线", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await waitForCanvasSave(page);
      await expect(edgeIn(page)).toHaveCount(1);
      // 可见线已有几何渲染
      await expect(edgeLine(page)).toHaveAttribute("d", /M .+ L .+/);
    } finally {
      await app.close();
    }
  });

  test("@CV-EDGE-002 双击连线编辑标签并持久化", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await waitForCanvasSave(page);
      const mid = edgeMidpoint(boxA, boxB);
      await page.mouse.dblclick(mid.x, mid.y);
      await expect(page.getByTestId("canvas-edge-label-editor")).toBeVisible({ timeout: 8000 });
      await page.getByTestId("canvas-edge-label-editor").locator("input").fill("EDGE_LABEL");
      await page.keyboard.press("Enter");
      // 标签文本出现
      await expect(
        page.getByTestId("canvas-graph").getByText("EDGE_LABEL", { exact: true }).first(),
      ).toBeVisible();
      await waitForCanvasSave(page);
      await leaveWorkspace(page);
      await reopenWorkspace(page);
      await expect(edgeIn(page)).toHaveCount(1);
      await expect(
        page.getByTestId("canvas-graph").getByText("EDGE_LABEL", { exact: true }).first(),
      ).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("@CV-EDGE-003 选中连线后通过右侧面板配置样式", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await waitForCanvasSave(page);
      await selectEdge(page, boxA, boxB);
      await expect(page.getByTestId("canvas-edge-style-panel")).toBeVisible();
      await page.getByTestId("edge-style-linestyle").selectOption("dashed");
      await page.getByTestId("edge-style-color-blue").click();
      // 可见线应用虚线 + 蓝色
      await expect(edgeLine(page)).toHaveAttribute("stroke", "#3b82f6");
      await expect(edgeLine(page)).toHaveAttribute("stroke-dasharray", "5 5");
    } finally {
      await app.close();
    }
  });

  test("@CV-EDGE-004 一键重置连线样式", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await waitForCanvasSave(page);
      await selectEdge(page, boxA, boxB);
      await page.getByTestId("edge-style-linestyle").selectOption("dashed");
      await page.getByTestId("edge-style-reset").click();
      await expect(edgeLine(page)).toHaveAttribute("stroke", /#94a3b8|rgb\(148, 163, 184\)/);
      await expect(edgeLine(page)).toHaveAttribute("stroke-dasharray", "none");
    } finally {
      await app.close();
    }
  });

  test("@CV-EDGE-005 连线随画布重进还原", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await waitForCanvasSave(page);
      await expect(edgeIn(page)).toHaveCount(1);
      await leaveWorkspace(page);
      await reopenWorkspace(page);
      await expect(edgeIn(page)).toHaveCount(1);
    } finally {
      await app.close();
    }
  });

  test("@CV-EDGE-006 删除连线", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await waitForCanvasSave(page);
      await selectEdge(page, boxA, boxB);
      await expect(page.getByTestId("canvas-edge-style-panel")).toBeVisible();
      await page.keyboard.press("Delete");
      await waitForCanvasSave(page);
      await expect(edgeIn(page)).toHaveCount(0);
    } finally {
      await app.close();
    }
  });
});
