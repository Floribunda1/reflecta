import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { openSeededCanvas, topmostChainAt } from "./canvas-integration";
test.beforeEach(() => {
  resetAgentFixtures();
});

test("selected edge's toolbar floats above the edge line instead of covering it", async () => {
  seedCanvas({
    id: "canvas",
    title: "EDGE_TOOLBAR",
    elements: [
      { id: "a", kind: "text", props: { text: "A" }, x: 120, y: 120, width: 200, height: 120 },
      { id: "b", kind: "text", props: { text: "B" }, x: 440, y: 120, width: 200, height: 120 },
    ],
    edges: [{ id: "ab", sourceElementId: "a", targetElementId: "b" }],
  });

  const { app, page } = await launchApp();
  try {
    await openSeededCanvas(page, "EDGE_TOOLBAR");
    const graph = page.getByTestId("canvas-graph");

    // 选中边 → edge toolbar 出现
    const edgeLine = graph.locator('.react-flow__edge[data-id="ab"] .react-flow__edge-path');
    await edgeLine.click({ force: true });
    const toolbar = graph.locator(".react-flow__edge-toolbar");
    await expect(toolbar).toBeVisible();

    // 工具栏整体在边线上方（bottom 不高于线段中点）
    const lineBox = (await edgeLine.boundingBox())!;
    const lineMidY = lineBox.y + lineBox.height / 2;
    const tbox = (await toolbar.boundingBox())!;
    // 工具栏整体位于边线上方（bottom 高于线段中点），不再盖住边。
    expect(tbox.y + tbox.height).toBeLessThan(lineMidY);
    // 工具栏置顶：中心点处最顶层元素是 edge-toolbar，不被节点遮挡。
    const chain = await topmostChainAt(page, tbox.x + tbox.width / 2, tbox.y + tbox.height / 2);
    expect(chain).toContain("react-flow__edge-toolbar");
  } finally {
    await app.close();
  }
});
