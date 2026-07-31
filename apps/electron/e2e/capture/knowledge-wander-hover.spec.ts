import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  domainNode,
  graphNodeCanvas,
  openCapturePage,
  visibleGraphNodePoints,
} from "./capture-e2e";

test("@KW-GRAPH-005 用户悬停节点时临时查看它的直接邻域", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();
    await page.getByTestId("capture-knowledge-wander-entry").click();
    const graph = page.getByTestId("knowledge-wander-graph");
    await expect(graph.locator('[data-graph-ready="true"]')).toBeAttached({ timeout: 15_000 });

    const canvas = graphNodeCanvas(graph);
    const baseline = await canvas.screenshot();
    const points = await visibleGraphNodePoints(page, canvas);
    const bounds = await canvas.boundingBox();
    if (!bounds || points.length === 0) throw new Error("Expected graph node positions");

    let hovered = false;
    for (const point of points) {
      await page.mouse.move(
        bounds.x + (point.x * bounds.width) / point.width,
        bounds.y + (point.y * bounds.height) / point.height,
      );
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      if (!(await canvas.screenshot()).equals(baseline)) {
        hovered = true;
        break;
      }
    }
    expect(hovered).toBe(true);
    await expect(page.getByTestId("capture-understanding-detail-panel")).not.toBeVisible();

    await page.mouse.move(bounds.x + 4, bounds.y + 4);
    await expect.poll(async () => (await canvas.screenshot()).equals(baseline)).toBe(true);
  } finally {
    await app.close();
  }
});
