import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { nodeInGraph, openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
});

/**
 * 画布级交互配置差异（CanvasGraph props，与 RF 默认不同）：
 * - 中键拖动 = 平移画布（panOnDrag=[1]；RF 默认不启用中键，左键拖拽让给框选、滚轮让给 panOnScroll）。
 * 断言验证「是平移不是缩放」：zoom 不变、x/y 变。
 * RF 内置的缩放/平移动画与触控板手势不在此覆盖（regression 已有滚轮只动视口测试）。
 */
test.describe("画布视口配置", () => {
  test("中键拖动平移画布：zoom 不变、x/y 变化", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 80, y: 80, width: 120, height: 80 },
        { id: "b", kind: "text", props: { text: "B" }, x: 620, y: 480, width: 120, height: 80 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const graph = page.getByTestId("canvas-graph");
      const viewport = graph.locator(".react-flow__viewport");

      // 起点取画布中央空白处（避开节点与 Minimap）
      const graphBox = (await graph.boundingBox())!;
      const start = { x: graphBox.x + graphBox.width / 2, y: graphBox.y + graphBox.height / 2 };
      await page.mouse.move(start.x, start.y);
      const before = await viewport.getAttribute("style");
      const beforeZoom = parseZoom(before);

      await page.mouse.down({ button: "middle" });
      await page.mouse.move(start.x - 120, start.y - 80, { steps: 10 });
      await page.mouse.up({ button: "middle" });

      await expect.poll(() => viewport.getAttribute("style")).not.toBe(before);
      const after = (await viewport.getAttribute("style"))!;
      expect(parseZoom(after)).toBeCloseTo(beforeZoom, 3);
      expect(parseTranslate(after)).not.toEqual(parseTranslate(before));
    } finally {
      await app.close();
    }
  });

  test("中键拖动不移动节点（只平移视口，节点画布位置不变）", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 120, y: 120, width: 120, height: 80 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const node = nodeInGraph(page, "a");
      await expect(node).toBeVisible();
      // 节点在画布内的位置 = wrapper 的 translate（视口位移不影响它）
      const beforeTransform = await node.getAttribute("style");
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      const start = { x: graphBox.x + graphBox.width / 2, y: graphBox.y + graphBox.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(start.x - 150, start.y - 100, { steps: 10 });
      await page.mouse.up({ button: "middle" });
      await expect(node).toHaveAttribute("style", beforeTransform);
    } finally {
      await app.close();
    }
  });
  test("无已存视口时进入画布自动 fitView（元素缩放进视野）", async () => {
    // 两卡相距很远，且未保存视口（viewport 为 null）
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 60, y: 60, width: 120, height: 80 },
        { id: "b", kind: "text", props: { text: "B" }, x: 2400, y: 2400, width: 120, height: 80 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      // fitView 会把相距很远的元素缩放进视野：scale < 1、translate 不再是原点
      const viewport = page.getByTestId("canvas-graph").locator(".react-flow__viewport");
      const transform = (await viewport.getAttribute("style"))!;
      expect(parseZoom(transform)).toBeLessThan(1);
      expect(parseTranslate(transform)).not.toBe("0px, 0px");
    } finally {
      await app.close();
    }
  });
});

function parseZoom(transform: string | null): number {
  const match = transform?.match(/scale\(([-\d.]+)\)/);
  return match ? Number(match[1]) : 1;
}

function parseTranslate(transform: string | null): string {
  const match = transform?.match(/translate\(([-\d.]+px, [-\d.]+px)\)/);
  return match ? match[1] : "";
}
