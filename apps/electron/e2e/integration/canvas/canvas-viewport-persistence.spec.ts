import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { canvasRow } from "../../acceptance/spec/canvas/canvas-e2e";
import { nodeInGraph, openSeededCanvas, leaveCanvasWorkspace } from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const ONE = {
  id: "canvas",
  title: "CANVAS",
  elements: [
    { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
  ],
  viewport: null,
} as const;

const graphZoom = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => (window as unknown as { __x6graph?: { zoom(): number } }).__x6graph?.zoom() ?? -1,
  );

test.describe("视口 / 网格", () => {
  test("缩放控件：放大改变视口 transform，适应视图可点", async () => {
    seedCanvas(ONE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await expect(page.getByTestId("canvas-zoom-controls")).toBeVisible();
      const before = await graphZoom(page);
      await page.getByTestId("canvas-zoom-in").click();
      await page.waitForTimeout(300);
      const after = await graphZoom(page);
      expect(after).toBeGreaterThan(before);
      await expect(page.getByTestId("canvas-zoom-fit")).toBeVisible();
    } finally {
      await app.close();
    }
  });
});

test.describe("持久化往返", () => {
  test("文本内容编辑后重进保留", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "t",
          kind: "text",
          props: { text: "hello" },
          x: 100,
          y: 100,
          width: 220,
          height: 120,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "t");
      await card.dblclick();
      await expect(card).toHaveAttribute("data-editing", "true", { timeout: 5000 });
      const prose = card.locator(".ProseMirror");
      await expect(prose).toHaveAttribute("contenteditable", "true", { timeout: 8000 });
      await prose.click();
      await page.keyboard.type("world");
      await card.click();
      await page.waitForTimeout(1400);

      await leaveCanvasWorkspace(page);
      await expect(page.getByTestId("canvas-page")).toBeVisible();
      await canvasRow(page, "CANVAS").click();
      await page.waitForTimeout(500);
      await expect(nodeInGraph(page, "t")).toContainText("world");
    } finally {
      await app.close();
    }
  });
});
