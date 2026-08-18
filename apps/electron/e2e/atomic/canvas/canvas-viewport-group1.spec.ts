import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import {
  dragToGraph,
  graphViewportTransform,
  inGraph,
  leaveWorkspace,
  openWorkspace,
  reopenWorkspace,
  waitForCanvasSave,
} from "../../acceptance/spec/canvas/canvas-e2e";

// Group 1 的 reload / 事件桥回写属于 CanvasGraph 的低层契约，留给 unit/integration；
// 这里仅验证真实用户可执行的加载、视口操作和重新进入恢复。
test.describe("画布原子操作 Group 1：加载与视口", () => {
  test("@CV-ATOM-001 加载画布文档", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await expect(page.getByTestId("canvas-workspace")).toBeVisible();
      await expect(page.getByTestId("canvas-graph")).toBeVisible();
      await expect(page.getByTestId("canvas-zoom-controls")).toBeVisible();
      await expect(page.getByTestId("canvas-minimap")).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-004 滚轮缩放画布", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      const graph = page.getByTestId("canvas-graph");
      const box = (await graph.boundingBox())!;
      const viewport = graphViewportTransform(page);
      const before = await viewport.getAttribute("transform");
      const modifier = process.platform === "darwin" ? "Meta" : "Control";

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down(modifier);
      await page.mouse.wheel(0, -300);
      await page.keyboard.up(modifier);

      await expect(async () => {
        expect(await viewport.getAttribute("transform")).not.toBe(before);
      }).toPass({ timeout: 5000 });
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-005 点击放大", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      const viewport = graphViewportTransform(page);
      const before = await viewport.getAttribute("transform");
      await page.getByTestId("canvas-zoom-in").click();

      await expect(async () => {
        expect(await viewport.getAttribute("transform")).not.toBe(before);
      }).toPass({ timeout: 5000 });
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-006 点击缩小", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await page.getByTestId("canvas-zoom-in").click();
      const viewport = graphViewportTransform(page);
      const before = await viewport.getAttribute("transform");
      await page.getByTestId("canvas-zoom-out").click();

      await expect(async () => {
        expect(await viewport.getAttribute("transform")).not.toBe(before);
      }).toPass({ timeout: 5000 });
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-007 点击适应视图", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-rect", { x: 240, y: 160 });
      await expect(inGraph(page, "canvas-shape-card")).toBeVisible({ timeout: 8000 });
      await page.getByTestId("canvas-zoom-in").click();
      const viewport = graphViewportTransform(page);
      const before = await viewport.getAttribute("transform");

      await page.getByTestId("canvas-zoom-fit").click();

      await expect(async () => {
        expect(await viewport.getAttribute("transform")).not.toBe(before);
      }).toPass({ timeout: 5000 });
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-008 点击缩略图位置", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-rect", { x: 200, y: 120 });
      await expect(inGraph(page, "canvas-shape-card")).toBeVisible({ timeout: 8000 });

      for (let i = 0; i < 4; i++) {
        await page.getByTestId("canvas-zoom-in").click();
        await page.waitForTimeout(120);
      }
      const viewport = graphViewportTransform(page);
      const before = await viewport.getAttribute("transform");
      const minimap = page.getByTestId("canvas-minimap");
      const minimapBox = (await minimap.boundingBox())!;
      await page.mouse.click(
        minimapBox.x + minimapBox.width / 2,
        minimapBox.y + minimapBox.height / 2,
      );

      await expect(async () => {
        expect(await viewport.getAttribute("transform")).not.toBe(before);
      }).toPass({ timeout: 5000 });
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-010 恢复已保存视口", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-rect", { x: 220, y: 140 });
      await expect(inGraph(page, "canvas-shape-card")).toBeVisible({ timeout: 8000 });
      await page.getByTestId("canvas-zoom-in").click();
      const viewport = graphViewportTransform(page);
      const expected = await viewport.getAttribute("transform");
      await waitForCanvasSave(page);

      await leaveWorkspace(page);
      await reopenWorkspace(page);

      await expect(graphViewportTransform(page)).toHaveAttribute("transform", expected!);
    } finally {
      await app.close();
    }
  });
});
