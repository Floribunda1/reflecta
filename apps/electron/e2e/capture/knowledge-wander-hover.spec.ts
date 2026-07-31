import { expect, test, type Locator } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { domainNode, openCapturePage } from "./capture-e2e";

type Rgb = [number, number, number];

async function findRenderedCanvas(graph: Locator) {
  const canvases = graph.locator("canvas");
  const index = await canvases.evaluateAll((elements) => {
    const opaqueCounts = elements.map((element) => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let offset = 3; offset < pixels.length; offset += 4) {
        if (pixels[offset] !== 0) count += 1;
      }
      return count;
    });
    return opaqueCounts.indexOf(Math.max(...opaqueCounts));
  });
  return canvases.nth(index);
}

async function readNodePixels(canvas: Locator, requestedColor?: Rgb) {
  return canvas.evaluate((element, color) => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let nodeColor = color;

    if (!nodeColor) {
      const colors = new Map<string, number>();
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] !== 255) continue;
        const key = `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`;
        colors.set(key, (colors.get(key) ?? 0) + 1);
      }
      const key = [...colors].sort((left, right) => right[1] - left[1])[0]?.[0];
      if (!key) throw new Error("Expected opaque graph nodes");
      nodeColor = key.split(",").map(Number) as Rgb;
    }

    let count = 0;
    let target = { x: 0, y: 0 };
    let targetDistance = Number.POSITIVE_INFINITY;
    for (let offset = 0, pixel = 0; offset < pixels.length; offset += 4, pixel += 1) {
      if (
        pixels[offset] !== nodeColor[0] ||
        pixels[offset + 1] !== nodeColor[1] ||
        pixels[offset + 2] !== nodeColor[2] ||
        pixels[offset + 3] !== 255
      ) {
        continue;
      }
      count += 1;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      const distance = Math.hypot(x - canvas.width / 2, y - canvas.height / 2);
      if (distance < targetDistance) {
        target = { x, y };
        targetDistance = distance;
      }
    }

    return { color: nodeColor, count, target, width: canvas.width, height: canvas.height };
  }, requestedColor);
}

test("@KW-GRAPH-005 用户悬停节点时临时查看它的直接邻域", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();
    await page.getByTestId("capture-knowledge-wander-entry").click();
    const graph = page.getByTestId("knowledge-wander-graph");
    await expect(graph.locator('[data-graph-ready="true"]')).toBeAttached({ timeout: 15_000 });

    const canvas = await findRenderedCanvas(graph);
    const baseline = await readNodePixels(canvas);
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Expected graph canvas bounds");

    await page.mouse.move(
      bounds.x + (baseline.target.x * bounds.width) / baseline.width,
      bounds.y + (baseline.target.y * bounds.height) / baseline.height,
    );
    await expect
      .poll(async () => (await readNodePixels(canvas, baseline.color)).count)
      .toBeLessThan(baseline.count * 0.5);
    await expect(page.getByTestId("capture-understanding-detail-panel")).not.toBeVisible();

    await page.mouse.move(bounds.x + 4, bounds.y + 4);
    await expect
      .poll(async () => (await readNodePixels(canvas, baseline.color)).count)
      .toBeGreaterThan(baseline.count * 0.9);
  } finally {
    await app.close();
  }
});
