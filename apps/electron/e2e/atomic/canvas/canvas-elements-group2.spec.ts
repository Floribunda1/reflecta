import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import {
  canvasRow,
  createCanvas,
  dragLocatorToGraph,
  dragToGraph,
  inGraph,
  openCanvasPage,
  openWorkspace,
} from "../../acceptance/spec/canvas/canvas-e2e";

async function dragOutsideGraph(page: Page, sourceTestId: string) {
  const source = page.getByTestId(sourceTestId);
  const sourceBox = (await source.boundingBox())!;
  const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(graphBox.x - 20, graphBox.y - 20, { steps: 8 });
  await page.mouse.up();
}

test.describe("画布原子操作 Group 2：元素拖入与创建", () => {
  test("@CV-ATOM-011 工具栏拖入文本卡到空白处", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 200, y: 120 });
      await expect(inGraph(page, "canvas-text-card")).toHaveCount(1, { timeout: 8000 });
      await expect(inGraph(page, "canvas-text-card")).toHaveText("");
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-012 工具栏拖入矩形到空白处", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-rect", { x: 200, y: 120 });
      const shape = inGraph(page, "canvas-shape-card");
      await expect(shape).toHaveCount(1, { timeout: 8000 });
      await expect(shape).toHaveAttribute("data-shape-type", "rect");
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-013 工具栏拖入圆形到空白处", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-circle", { x: 200, y: 120 });
      const shape = inGraph(page, "canvas-shape-card");
      await expect(shape).toHaveCount(1, { timeout: 8000 });
      await expect(shape).toHaveAttribute("data-shape-type", "circle");
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-014 工具栏拖入组到空白处", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-group", { x: 300, y: 240 });
      await expect(inGraph(page, "canvas-group-node")).toHaveCount(1, { timeout: 8000 });
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-015 理解库拖入理解卡到空白处", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await page.getByTestId("canvas-toggle-library-button").click();
      await expect(page.getByTestId("canvas-library-panel")).toBeVisible();
      const item = page.locator(
        '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]',
      );
      await expect(item).toBeVisible();
      await dragLocatorToGraph(page, item, { x: 200, y: 120 });
      const card = inGraph(page, "canvas-understanding-card");
      await expect(card).toHaveCount(1, { timeout: 8000 });
      await expect(card).toContainText("React Server Components");
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-016 画布引用选择目标画布", async () => {
    const { app, page } = await launchApp();
    try {
      await openCanvasPage(page);
      await createCanvas(page);
      await createCanvas(page);
      await canvasRow(page, "未命名画布").first().click();
      await expect(page.getByTestId("canvas-workspace")).toBeVisible();

      await page.getByTestId("canvas-open-canvasref-picker").click();
      await expect(page.getByTestId("canvas-ref-picker-option").first()).toBeVisible();
      await page.getByTestId("canvas-ref-picker-option").first().click();

      await expect(inGraph(page, "canvas-canvas-ref-card")).toHaveCount(1, {
        timeout: 8000,
      });
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-017 元素拖入画布指定位置", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      const graph = page.getByTestId("canvas-graph");
      const graphBox = (await graph.boundingBox())!;
      const dropPoint = { x: 260, y: 180 };
      await dragToGraph(page, "canvas-tool-dnd-rect", dropPoint);
      const card = inGraph(page, "canvas-shape-card");
      await expect(card).toBeVisible({ timeout: 8000 });
      const cardBox = (await card.boundingBox())!;
      const center = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
      expect(Math.abs(center.x - (graphBox.x + dropPoint.x))).toBeLessThan(40);
      expect(Math.abs(center.y - (graphBox.y + dropPoint.y))).toBeLessThan(40);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-018 元素拖入已有组区域", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-group", { x: 320, y: 240 });
      const group = inGraph(page, "canvas-group-node");
      await expect(group).toBeVisible({ timeout: 8000 });
      const groupBox = (await group.boundingBox())!;
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      const groupCenter = {
        x: groupBox.x + groupBox.width / 2 - graphBox.x,
        y: groupBox.y + groupBox.height / 2 - graphBox.y,
      };

      await dragToGraph(page, "canvas-tool-dnd-text", groupCenter);
      const text = inGraph(page, "canvas-text-card");
      await expect(text).toBeVisible({ timeout: 8000 });
      const textBox = (await text.boundingBox())!;
      const textCenter = { x: textBox.x + textBox.width / 2, y: textBox.y + textBox.height / 2 };
      expect(textCenter.x).toBeGreaterThan(groupBox.x);
      expect(textCenter.x).toBeLessThan(groupBox.x + groupBox.width);
      expect(textCenter.y).toBeGreaterThan(groupBox.y);
      expect(textCenter.y).toBeLessThan(groupBox.y + groupBox.height);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-019 拖拽未落在画布内", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragOutsideGraph(page, "canvas-tool-dnd-text");
      await expect(inGraph(page, "canvas-text-card")).toHaveCount(0);
    } finally {
      await app.close();
    }
  });
});
