import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("edge with arrowhead renders a live arrow marker", async () => {
  seedCanvas({
    id: "edge-arrow",
    title: "EDGE_ARROW",
    elements: [
      { id: "a", kind: "text", props: { text: "A" }, x: 80, y: 80, width: 200, height: 100 },
      { id: "b", kind: "text", props: { text: "B" }, x: 440, y: 80, width: 200, height: 100 },
    ],
    edges: [
      {
        id: "ab",
        sourceElementId: "a",
        targetElementId: "b",
        style: { routing: "curve", arrowhead: "arrow" },
      },
    ],
  });

  const { app, page } = await launchApp();
  try {
    await openSeededCanvas(page, "EDGE_ARROW");
    const graph = page.getByTestId("canvas-graph");

    // RF 为对象形式 markerEnd 生成的 marker def（含 arrow 类型）
    await expect(graph.locator(".react-flow__marker marker.react-flow__arrowhead")).toHaveCount(1);
    // 边的路径确实引用了该 marker
    const pathMarker = await graph
      .locator('.react-flow__edge[data-id="ab"] .react-flow__edge-path')
      .getAttribute("marker-end");
    expect(pathMarker).toMatch(/url\('#[^']*type=arrow/);
  } finally {
    await app.close();
  }
});
