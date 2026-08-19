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

/** 从卡片 A 右缘拖到卡片 B 左缘，建立有向边。 */
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
  page.getByTestId("canvas-graph").locator(".react-flow__edge");

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
      await expect(edgeLine(page)).toHaveAttribute("d", /M .+/);
    } finally {
      await app.close();
    }
  });

  test("@CV-EDGE-002 双击连线编辑标签并持久化", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await expect(edgeIn(page)).toHaveCount(1);
      await edgeLine(page).dblclick();
      await page.getByLabel("连线标签").fill("EDGE_LABEL");
      await page.getByLabel("连线标签").press("Enter");
      await expect(page.getByTestId("canvas-graph")).toContainText("EDGE_LABEL");
      await waitForCanvasSave(page);
      await leaveWorkspace(page);
      await reopenWorkspace(page);
      await expect(page.getByTestId("canvas-graph")).toContainText("EDGE_LABEL");
    } finally {
      await app.close();
    }
  });

  test("@CV-EDGE-003 通过右侧面板配置连线样式", async () => {
    const { app, page } = await launchApp();
    try {
      const { boxA, boxB } = await setupTwoCards(page);
      await drawEdge(page, boxA, boxB);
      await selectEdge(page, boxA, boxB);
      await expect(page.getByTestId("canvas-edge-style-panel")).toBeVisible();
      await page.getByTestId("edge-style-linestyle").click();
      await page.getByRole("option", { name: "虚线" }).click();
      await page.getByTestId("edge-style-color-3b82f6").click();
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
      await selectEdge(page, boxA, boxB);
      await page.getByTestId("edge-style-linestyle").click();
      await page.getByRole("option", { name: "虚线" }).click();
      await page.getByTestId("edge-style-reset").click();
      await expect(edgeLine(page)).toHaveAttribute("stroke", "#94a3b8");
      await expect(edgeLine(page)).not.toHaveAttribute("stroke-dasharray", "5 5");
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
      await page.keyboard.press("Backspace");
      await waitForCanvasSave(page);
      await expect(edgeIn(page)).toHaveCount(0);
    } finally {
      await app.close();
    }
  });
});
