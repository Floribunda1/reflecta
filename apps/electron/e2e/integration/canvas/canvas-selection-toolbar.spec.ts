import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import {
  boxSelectNodes,
  nodeInGraph,
  openSeededCanvas,
  topmostChainAt,
} from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
  seedCanvas({
    id: "canvas",
    title: "SELECT",
    elements: [
      { id: "a", kind: "text", props: { text: "A" }, x: 120, y: 120, width: 200, height: 120 },
      { id: "b", kind: "text", props: { text: "B" }, x: 420, y: 180, width: 200, height: 120 },
    ],
    edges: [{ id: "ab", sourceElementId: "a", targetElementId: "b" }],
  });
});

async function nodeBoxes(page: import("@playwright/test").Page) {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (const id of ["a", "b"]) {
    boxes.push((await nodeInGraph(page, id).boundingBox())!);
  }
  return boxes;
}

test("multi-select shows one selection toolbar above the area with group+delete, hides per-node toolbars", async () => {
  const { app, page } = await launchApp();
  try {
    await openSeededCanvas(page, "SELECT");
    const graph = page.getByTestId("canvas-graph");

    // 单选：显示该节点自己的操作工具栏，不显示选区工具条
    await nodeInGraph(page, "a").click();
    await expect(graph.getByTestId("canvas-selection-toolbar")).toHaveCount(0);
    expect(await graph.locator(".react-flow__node-toolbar").count()).toBe(1);

    // 框选两个：节点自身工具栏隐藏，出现一个选区工具栏（含打组 + 删除）
    const boxes = await nodeBoxes(page);
    await boxSelectNodes(page, boxes);
    const toolbar = graph.getByTestId("canvas-selection-toolbar");
    await expect(toolbar).toBeVisible();
    expect(await graph.locator(".react-flow__node-toolbar").count()).toBe(0);
    // 多选时边的工具栏也不展示（统一交给选区工具栏）
    expect(await graph.locator(".react-flow__edge-toolbar").count()).toBe(0);
    await expect(toolbar.getByTestId("canvas-selection-group-button")).toBeVisible();
    await expect(toolbar.getByTestId("canvas-selection-delete-button")).toBeVisible();

    // 工具栏位于选区上方（bottom 不高于选区顶边）
    const tbox = (await toolbar.boundingBox())!;
    const minY = Math.min(...boxes.map((b) => b.y));
    expect(tbox.y + tbox.height).toBeLessThan(minY + 5);
    // 工具栏置顶：中心点最顶层元素是选区工具栏
    const chain = await topmostChainAt(page, tbox.x + tbox.width / 2, tbox.y + tbox.height / 2);
    expect(chain).toContain("canvas-selection-toolbar");

    // 平移时工具栏跟随图形（不固定在原屏幕位置）
    const beforeToolbar = (await toolbar.boundingBox())!;
    const aNode = nodeInGraph(page, "a");
    const beforeNode = (await aNode.boundingBox())!;
    const pane = graph.locator(".react-flow__pane");
    const pb = (await pane.boundingBox())!;
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(pb.x + pb.width / 2 - 120, pb.y + pb.height / 2 - 80, { steps: 8 });
    await page.mouse.up({ button: "middle" });
    await page.waitForTimeout(200);
    const afterToolbar = (await toolbar.boundingBox())!;
    const afterNode = (await aNode.boundingBox())!;
    // 工具栏与节点以相同位移移动（相对选区保持）
    expect(afterToolbar.x - beforeToolbar.x).toBeCloseTo(afterNode.x - beforeNode.x, 0);
    expect(afterToolbar.y - beforeToolbar.y).toBeCloseTo(afterNode.y - beforeNode.y, 0);

    // 删除：清空选区相关元素
    await toolbar.getByTestId("canvas-selection-delete-button").click();
    await expect(graph.locator(".react-flow__node")).toHaveCount(0);
    await expect(toolbar).toHaveCount(0);
  } finally {
    await app.close();
  }
});
