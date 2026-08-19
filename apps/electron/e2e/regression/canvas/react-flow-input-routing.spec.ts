import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import {
  canvasRow,
  dragToGraph,
  graphViewportTransform,
  openCanvasPage,
} from "../../acceptance/spec/canvas/canvas-e2e";

test.beforeEach(() => {
  resetAgentFixtures();
  seedCanvas({
    id: "react-flow-input-routing",
    title: "REACT_FLOW_INPUT_ROUTING",
    elements: [
      {
        id: "node-a",
        kind: "text",
        props: { text: Array.from({ length: 30 }, (_, index) => `LINE_${index}`).join("\n\n") },
        x: 100,
        y: 100,
        width: 220,
        height: 120,
      },
      { id: "node-b", kind: "text", props: { text: "B" }, x: 440, y: 100 },
      {
        id: "group",
        kind: "group",
        props: { label: "GROUP" },
        x: 120,
        y: 380,
        width: 360,
        height: 220,
      },
      {
        id: "group-child",
        kind: "text",
        props: { text: "CHILD" },
        parentId: "group",
        x: 40,
        y: 60,
        width: 160,
        height: 90,
      },
    ],
    edges: [
      { id: "edge-ab", sourceElementId: "node-a", targetElementId: "node-b", label: "EDGE_LABEL" },
    ],
  });
});

async function openRoutingCanvas() {
  const launched = await launchApp();
  await openCanvasPage(launched.page);
  await canvasRow(launched.page, "REACT_FLOW_INPUT_ROUTING").click();
  await expect(launched.page.getByTestId("canvas-graph")).toBeVisible();
  return launched;
}

test("pane drag selects nodes while node drag moves the node", async () => {
  const { app, page } = await openRoutingCanvas();
  try {
    const graph = page.getByTestId("canvas-graph");
    const first = graph.locator('.react-flow__node[data-id="node-a"]');
    const second = graph.locator('.react-flow__node[data-id="node-b"]');
    await expect(first).toBeVisible();
    const firstBefore = await first.boundingBox();
    const secondBefore = await second.boundingBox();
    if (!firstBefore || !secondBefore) throw new Error("Canvas nodes are not measurable");

    await page.mouse.move(firstBefore.x - 20, firstBefore.y - 20);
    await page.mouse.down();
    await page.mouse.move(firstBefore.x + 30, firstBefore.y + 30, { steps: 10 });
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

    const transform = await first.getAttribute("style");
    const position = transform?.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    expect(Number(position?.[1]) % 20).toBe(0);
    expect(Number(position?.[2]) % 20).toBe(0);

    const firstAfter = await first.boundingBox();
    const secondForGroup = await second.boundingBox();
    if (!firstAfter || !secondForGroup) throw new Error("Nodes are not measurable for grouping");
    await page.mouse.move(firstAfter.x - 10, firstAfter.y - 10);
    await page.mouse.down();
    await page.mouse.move(
      secondForGroup.x + secondForGroup.width + 10,
      secondForGroup.y + secondForGroup.height + 10,
      { steps: 10 },
    );
    await page.mouse.up();
    await page.keyboard.press("Meta+g");
    await expect(graph.locator(".react-flow__node-group")).toHaveCount(2);
    await page.keyboard.press("Meta+Shift+g");
    await expect(graph.locator(".react-flow__node-group")).toHaveCount(1);
  } finally {
    await app.close();
  }
});

test("handle drag creates an edge without moving its node, and edge label editing stays on the edge", async () => {
  const { app, page } = await openRoutingCanvas();
  try {
    const graph = page.getByTestId("canvas-graph");
    const sourceNode = graph.locator('.react-flow__node[data-id="node-a"]');
    const targetNode = graph.locator('.react-flow__node[data-id="node-b"]');
    const sourceBefore = await sourceNode.boundingBox();
    const sourceHandle = sourceNode.locator(".react-flow__handle.source");
    const targetHandle = targetNode.locator(".react-flow__handle.target");
    await sourceHandle.dragTo(targetHandle);
    await expect(graph.locator(".react-flow__edge")).toHaveCount(2);
    expect((await sourceNode.boundingBox())?.x).toBeCloseTo(sourceBefore!.x, 0);
    expect((await sourceNode.boundingBox())?.y).toBeCloseTo(sourceBefore!.y, 0);

    const edgePath = graph.locator(
      '.react-flow__edge[data-id="edge-ab"] .react-flow__edge-interaction',
    );
    await edgePath.dispatchEvent("click");
    await expect(graph.locator('.react-flow__edge[data-id="edge-ab"]')).toHaveClass(/selected/);
    const label = graph.getByText("EDGE_LABEL", { exact: true });
    await label.dispatchEvent("dblclick");
    const input = graph.getByRole("textbox", { name: "连线标签" });
    await input.fill("CANCELLED");
    await input.press("Escape");
    await expect(label).toHaveText("EDGE_LABEL");
    await label.dispatchEvent("dblclick");
    await input.fill("UPDATED_LABEL");
    await input.press("Enter");
    await expect(graph.getByText("UPDATED_LABEL", { exact: true })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("resizer, text editor, card scroll, and Backspace route to the active target", async () => {
  const { app, page } = await openRoutingCanvas();
  try {
    const graph = page.getByTestId("canvas-graph");
    const node = graph.locator('.react-flow__node[data-id="node-a"]');
    await node.click();
    const beforeResize = await node.boundingBox();
    const resizeHandle = node.locator(".react-flow__resize-control.handle.bottom.right");
    const resizeBox = await resizeHandle.boundingBox();
    if (!resizeBox || !beforeResize) throw new Error("Node resizer is not measurable");
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + 80, resizeBox.y + 60, { steps: 8 });
    await page.mouse.up();
    const afterResize = await node.boundingBox();
    expect(afterResize!.width).toBeGreaterThan(beforeResize.width + 20);
    expect(afterResize!.x).toBeCloseTo(beforeResize.x, 0);
    expect(afterResize!.y).toBeCloseTo(beforeResize.y, 0);

    const scrollArea = node.locator(".nowheel").last();
    const viewportBeforeScroll = await graphViewportTransform(page).getAttribute("style");
    await scrollArea.hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await graphViewportTransform(page).getAttribute("style")).toBe(viewportBeforeScroll);

    await node.getByTestId("canvas-text-card").dblclick();
    const editor = node.getByRole("textbox", { name: "文本卡内容" });
    const beforeEditorDrag = await node.boundingBox();
    await editor.press("Backspace");
    await expect(node).toBeVisible();
    const editorBox = await editor.boundingBox();
    if (!editorBox) throw new Error("Text editor is not measurable");
    await page.mouse.move(editorBox.x + 20, editorBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(editorBox.x + 80, editorBox.y + 60, { steps: 5 });
    await page.mouse.up();
    expect((await node.boundingBox())?.x).toBeCloseTo(beforeEditorDrag!.x, 0);
    expect((await node.boundingBox())?.y).toBeCloseTo(beforeEditorDrag!.y, 0);
    await editor.press("Escape");
    await node.click();
    await page.keyboard.press("Backspace");
    await expect(node).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("pane wheel and MiniMap input change only the viewport", async () => {
  const { app, page } = await openRoutingCanvas();
  try {
    const graph = page.getByTestId("canvas-graph");
    const viewport = graphViewportTransform(page);
    const graphBox = await graph.boundingBox();
    if (!graphBox) throw new Error("Canvas graph is not measurable");
    const beforeWheel = await viewport.getAttribute("style");
    await page.mouse.move(graphBox.x + graphBox.width / 2, graphBox.y + graphBox.height / 2);
    await page.mouse.wheel(120, 160);
    await expect.poll(() => viewport.getAttribute("style")).not.toBe(beforeWheel);

    const minimap = graph.locator(".react-flow__minimap");
    const minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("MiniMap is not measurable");
    const beforeMiniMap = await viewport.getAttribute("style");
    await page.mouse.move(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      minimapBox.x + minimapBox.width / 2 + 30,
      minimapBox.y + minimapBox.height / 2 + 20,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect.poll(() => viewport.getAttribute("style")).not.toBe(beforeMiniMap);
  } finally {
    await app.close();
  }
});

test("external drag uses flow coordinates and a child remains constrained by its expanding group", async () => {
  const { app, page } = await openRoutingCanvas();
  try {
    const graph = page.getByTestId("canvas-graph");
    const nodes = graph.locator(".react-flow__node");
    await expect(nodes).toHaveCount(4);
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 700, y: 260 });
    await expect(nodes).toHaveCount(5);
    const dropped = nodes.filter({ has: page.getByTestId("canvas-text-card") }).last();
    const droppedBox = await dropped.boundingBox();
    const graphBox = await graph.boundingBox();
    expect(droppedBox!.x).toBeGreaterThan(graphBox!.x + 500);

    const group = graph.locator('.react-flow__node[data-id="group"]');
    const child = graph.locator('.react-flow__node[data-id="group-child"]');
    const groupBefore = await group.boundingBox();
    const childBefore = await child.boundingBox();
    if (!groupBefore || !childBefore) throw new Error("Group nodes are not measurable");
    await page.mouse.move(
      childBefore.x + childBefore.width / 2,
      childBefore.y + childBefore.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(groupBefore.x + groupBefore.width + 120, childBefore.y + 30, {
      steps: 12,
    });
    await page.mouse.up();
    const groupAfter = await group.boundingBox();
    const childAfter = await child.boundingBox();
    expect(groupAfter!.width).toBeGreaterThan(groupBefore.width);
    expect(childAfter!.x + childAfter!.width).toBeLessThanOrEqual(
      groupAfter!.x + groupAfter!.width + 1,
    );

    await group.getByTestId("canvas-group-label").click({ button: "right" });
    await expect(page.getByTestId("canvas-group-ungroup")).toBeVisible();
    await page.getByTestId("canvas-group-ungroup").click();
    await expect(group).toHaveCount(0);
    await expect(child).toBeVisible();
  } finally {
    await app.close();
  }
});
