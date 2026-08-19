import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import {
  dragHandleToHandle,
  edgeLineInGraph,
  edgesInGraph,
  nodeInGraph,
  openSeededCanvas,
} from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
});

const TWO_CARDS = {
  id: "canvas",
  title: "CANVAS",
  elements: [
    { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 200, height: 100 },
    { id: "b", kind: "text", props: { text: "B" }, x: 500, y: 100, width: 200, height: 100 },
  ],
} as const;

/**
 * 自建边渲染与语义（edges.tsx / graph-document.ts）：
 * - Handle 布局：source 在卡片右缘、target 在左缘（Harness 自建「左入右出」磁吸点，非 RF 默认）；
 * - 平行边/自环不去重（appendCanvasConnection 自建语义，M4-5）；
 * - 样式面板全映射：routing 三种路径、粗细、箭头（CV-EDGE-003 只覆盖了线型+颜色）；
 * - 删除卡片连带删除其连线（M7-4，依赖 RF 引擎 + 文档同步回写）。
 * RF 内置的路径几何计算、Handle 命中判定不在本文件覆盖。
 */
test.describe("画布连线定制", () => {
  test("source handle 位于卡片右缘、target 位于左缘（左入右出）", async () => {
    seedCanvas(TWO_CARDS);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      for (const id of ["a", "b"]) {
        const node = nodeInGraph(page, id);
        const box = (await node.boundingBox())!;
        const source = (await node.locator(".react-flow__handle.source").boundingBox())!;
        const target = (await node.locator(".react-flow__handle.target").boundingBox())!;
        // handle 中心应落在节点边缘 ±12px（handle 8px 宽）
        expect(source.x + source.width / 2).toBeGreaterThan(box.x + box.width - 12);
        expect(source.x + source.width / 2).toBeLessThan(box.x + box.width + 12);
        expect(target.x + target.width / 2).toBeGreaterThan(box.x - 12);
        expect(target.x + target.width / 2).toBeLessThan(box.x + 12);
      }
    } finally {
      await app.close();
    }
  });

  test("同一对卡片可建立多条连线（不去重）", async () => {
    seedCanvas(TWO_CARDS);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const nodeA = nodeInGraph(page, "a");
      const nodeB = nodeInGraph(page, "b");
      await dragHandleToHandle(page, nodeA, nodeB);
      await dragHandleToHandle(page, nodeA, nodeB);
      await expect(edgesInGraph(page)).toHaveCount(2);
    } finally {
      await app.close();
    }
  });

  test("样式面板：路由切换改变路径，粗细与箭头映射到渲染边", async () => {
    seedCanvas({
      ...TWO_CARDS,
      edges: [{ id: "e1", sourceElementId: "a", targetElementId: "b" }],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const edgeLine = edgeLineInGraph(page);
      // SVG path 的可见性判定在 Playwright 里不可靠，用存在性断言（count + attribute）。
      await expect(edgeLine).toHaveCount(1);
      await expect(edgeLine).toHaveAttribute("d", /^M/);

      // 用几何中点真实点击选中边（与 CV-EDGE-003 同一交互方式）
      const boxA = (await nodeInGraph(page, "a").boundingBox())!;
      const boxB = (await nodeInGraph(page, "b").boundingBox())!;
      const mid = {
        x: (boxA.x + boxA.width + boxB.x) / 2,
        y: (boxA.y + boxA.height / 2 + boxB.y + boxB.height / 2) / 2,
      };
      await page.mouse.click(mid.x, mid.y);
      await expect(page.getByTestId("canvas-edge-style-panel")).toBeVisible({ timeout: 8000 });

      // 路由：曲线（默认）→ 直线 → 正交，路径几何应随之变化
      const curvePath = await edgeLine.getAttribute("d");
      await page.getByTestId("edge-style-routing").click();
      const straightOption = page.getByRole("option", { name: "直线" });
      await expect(straightOption).toBeVisible({ timeout: 8000 });
      await straightOption.click();
      await expect(edgeLine).not.toHaveAttribute("d", curvePath, { timeout: 8000 });

      // 粗细：粗 → stroke-width 4
      const widthTrigger = page.getByTestId("edge-style-width");
      await widthTrigger.click();
      const thickOption = page.getByRole("option", { name: "粗" });
      await expect(thickOption).toBeVisible({ timeout: 8000 });
      await thickOption.click();
      await expect(edgeLine).toHaveCSS("stroke-width", "4px", { timeout: 8000 });

      // 箭头：实心箭头 → marker-end 变化（arrow → block 是不同的 RF marker）
      const markerBefore = await edgeLine.evaluate(
        (el) => getComputedStyle(el).markerEnd || el.getAttribute("marker-end") || "",
      );
      await page.getByTestId("edge-style-arrowhead").click();
      const blockOption = page.getByRole("option", { name: "实心箭头" });
      await expect(blockOption).toBeVisible({ timeout: 8000 });
      await blockOption.click();
      await expect
        .poll(
          () =>
            edgeLine.evaluate(
              (el) => getComputedStyle(el).markerEnd || el.getAttribute("marker-end") || "",
            ),
          { timeout: 8000 },
        )
        .not.toBe(markerBefore);
    } finally {
      await app.close();
    }
  });

  test("删除卡片时其连线一并删除，另一端卡片保留", async () => {
    seedCanvas({
      ...TWO_CARDS,
      edges: [{ id: "e1", sourceElementId: "a", targetElementId: "b" }],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await expect(edgesInGraph(page)).toHaveCount(1);

      await nodeInGraph(page, "a").click();
      await page.keyboard.press("Backspace");
      await expect(nodeInGraph(page, "a")).toHaveCount(0);
      await expect(edgesInGraph(page)).toHaveCount(0);
      await expect(nodeInGraph(page, "b")).toBeVisible();
    } finally {
      await app.close();
    }
  });
});
