import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const EMPTY = { id: "canvas", title: "CANVAS", elements: [], edges: [] } as const;

test.describe("编辑辅助（内建插件）", () => {
  test("History：撤销创建文本卡后节点消失", async () => {
    seedCanvas(EMPTY);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await page.getByTestId("canvas-tool-dnd-text").click();
      await expect(
        page.getByTestId("canvas-graph").getByTestId("canvas-text-card").first(),
      ).toBeVisible();
      await page.waitForTimeout(250);
      const nodeCount = () =>
        page.evaluate(
          () =>
            (window as unknown as { __x6graph?: { getNodes(): unknown[] } }).__x6graph?.getNodes()
              .length ?? -1,
        );
      await page.keyboard.press("Meta+z");
      await expect.poll(nodeCount, { timeout: 5000, intervals: [250] }).toBe(0);
      await page.keyboard.press("Meta+Shift+z");
      await expect.poll(nodeCount, { timeout: 5000, intervals: [250] }).toBe(1);
    } finally {
      await app.close();
    }
  });

  test("MiniMap 出现", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await expect(page.locator("[class*='x6-widget-minimap']").first()).toBeVisible();
    } finally {
      await app.close();
    }
  });
});
