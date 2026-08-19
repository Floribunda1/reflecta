import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { canvasRow, openCanvasPage } from "../../acceptance/spec/canvas/canvas-e2e";

test.beforeEach(() => {
  resetAgentFixtures();
  seedCanvas({
    id: "react-flow-input-routing",
    title: "REACT_FLOW_INPUT_ROUTING",
    elements: [
      { id: "node-a", kind: "text", props: { text: "A" }, x: 100, y: 100 },
      { id: "node-b", kind: "text", props: { text: "B" }, x: 440, y: 100 },
    ],
  });
});

test("pane drag selects nodes while node drag moves the node", async () => {
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await canvasRow(page, "REACT_FLOW_INPUT_ROUTING").click();

    const graph = page.getByTestId("canvas-graph");
    const first = graph.locator('.react-flow__node[data-id="node-a"]');
    const second = graph.locator('.react-flow__node[data-id="node-b"]');
    await expect(first).toBeVisible();
    const firstBefore = await first.boundingBox();
    const secondBefore = await second.boundingBox();
    if (!firstBefore || !secondBefore) throw new Error("Canvas nodes are not measurable");

    await page.mouse.move(firstBefore.x - 20, firstBefore.y - 20);
    await page.mouse.down();
    await page.mouse.move(
      firstBefore.x + firstBefore.width + 20,
      firstBefore.y + firstBefore.height + 20,
      { steps: 10 },
    );
    await page.mouse.up();
    await expect(first).toHaveClass(/selected/);
    await expect(second).not.toHaveClass(/selected/);

    await page.mouse.move(
      firstBefore.x + firstBefore.width / 2,
      firstBefore.y + firstBefore.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      firstBefore.x + firstBefore.width / 2 + 80,
      firstBefore.y + firstBefore.height / 2 + 60,
      { steps: 10 },
    );
    await page.mouse.up();

    await expect
      .poll(async () => (await first.boundingBox())?.x)
      .toBeGreaterThan(firstBefore.x + 20);
    const secondAfter = await second.boundingBox();
    expect(secondAfter?.x).toBeCloseTo(secondBefore.x, 0);
    expect(secondAfter?.y).toBeCloseTo(secondBefore.y, 0);
  } finally {
    await app.close();
  }
});
