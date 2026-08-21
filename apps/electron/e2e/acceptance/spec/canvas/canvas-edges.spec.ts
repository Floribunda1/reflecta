import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/** 连线：创建 / 平行边 / 默认契约 / 样式 / 标签 / 删除 / 边选择 / 平行边持久化。 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-edge",
    title: "EDGE",
    elements: [
      { id: "e_a", kind: "text", props: { text: "A" }, x: 100, y: 150, width: 120, height: 80 },
      { id: "e_b", kind: "text", props: { text: "B" }, x: 420, y: 150, width: 120, height: 80 },
    ],
    edges: [],
  });
  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
});
test.afterEach(async () => {
  // 让改动后的防抖保存落库，避免下一场景重进画布时读到旧文档
  if (page) await page.waitForTimeout(1400);
});

test.afterAll(async () => {
  await app?.close();
});

async function connectAToB(offsetY = 0) {
  const a = (await h.nodeInGraph(page!, "e_a").first().boundingBox())!;
  const b = (await h.nodeInGraph(page!, "e_b").first().boundingBox())!;
  await page!.mouse.move(a.x + a.width, a.y + a.height / 2 + offsetY);
  await page!.mouse.down();
  await page!.mouse.move(b.x, b.y + b.height / 2 + offsetY, { steps: 10 });
  await page!.mouse.up();
  await page!.waitForTimeout(300);
}

test("@CV-X6-EDGE-001 从出桩拖到入桩建立有向边", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await connectAToB();
  const edges = await h.edgeModel(page!);
  expect(edges.length).toBe(1);
  expect(edges[0].source).toBe("e_a");
  expect(edges[0].target).toBe("e_b");
});

test("@CV-X6-SEL-002 单击选中边出现底部边工具栏", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await connectAToB(); // 场景前置：画布上存在一条边
  await h.selectEdge(page!);
  await expect(page!.getByTestId("canvas-edge-toolbar")).toBeVisible();
});

test("@CV-X6-EDGE-003 新连线自带画布归属与默认样式", async () => {
  await h.openCanvasRow(page!, "EDGE");
  const edges = await h.edgeModel(page!);
  expect(edges[0].canvasId).toBe("cvx-edge");
  expect((edges[0].style as { routing?: string })?.routing).toBe("curve");
});

test("@CV-X6-EDGE-002 建立同源同目标的平行边", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await connectAToB(); // 前提：两条边的画布
  await connectAToB(); // 平行边
  await expect.poll(async () => (await h.edgeModel(page!)).length).toBe(2);
});

test("@CV-X6-PERSIST-003 平行边重载不去重、不丢失", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await expect.poll(async () => (await h.edgeModel(page!)).length).toBe(2);
});

test("@CV-X6-EDGE-004 调整连线样式并保留", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await h.selectEdge(page!);
  await expect(page!.getByTestId("canvas-edge-toolbar")).toBeVisible();
  await page!.getByTitle("颜色").first().click();
  await page!.locator("button[title='chart-1']").first().click();
  await page!.waitForTimeout(300);
  await page!.getByTitle("形状").click();
  await page!.getByText("直线", { exact: true }).first().click();
  await page!.getByTitle("线型").click();
  await page!.getByText("虚线", { exact: true }).first().click();
  await page!.getByTitle("线宽").click();
  await page!.getByText("粗", { exact: true }).first().click();
  await page!.getByTitle("箭头").click();
  await page!.getByText("圆点", { exact: true }).first().click();
  await page!.waitForTimeout(400);
  const s1 = await h.edgeModel(page!);
  expect(s1[0].strokeToken).toBe("var(--chart-1)");
  expect(s1[0].connector).toBe("normal");
  expect(s1[0].dasharray).toBe("5 5");
  expect(s1[0].strokeWidth).toBe(4);
  expect(s1[0].marker).toBe("circle");
  await h.openCanvasRow(page!, "EDGE");
  await expect.poll(async () => (await h.edgeModel(page!))[0]?.strokeToken).toBe("var(--chart-1)");
  const s2 = await h.edgeModel(page!);
  expect(s2[0].connector).toBe("normal");
  expect(s2[0].marker).toBe("circle");
});

test("@CV-X6-EDGE-005 双击边标签编辑并提交", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await h.selectEdge(page!);
  const label = page!.getByTestId("canvas-edge-label").first();
  await expect(label).toBeVisible();
  await label.click({ clickCount: 2 });
  await page!.waitForTimeout(200);
  await label.click();
  await page!.keyboard.type("EDGE_LABEL");
  await page!.keyboard.press("Enter");
  await page!.waitForTimeout(400);
  await h.openCanvasRow(page!, "EDGE");
  await expect(page!.getByTestId("canvas-edge-label").first()).toHaveText("EDGE_LABEL", {
    timeout: 8000,
  });
});

test("@CV-X6-EDGE-006 清空边标签回到无标签", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await h.selectEdge(page!);
  const label = page!.getByTestId("canvas-edge-label").first();
  await label.click({ clickCount: 2 });
  await page!.waitForTimeout(200);
  await label.click();
  await page!.keyboard.press("End");
  for (let i = 0; i < 10; i++) await page!.keyboard.press("Backspace");
  await page!.keyboard.press("Enter");
  await page!.waitForTimeout(400);
  const edges = await h.edgeModel(page!);
  expect(edges[0].label).toBeNull();
});

test("@CV-X6-EDGE-007 从边工具栏删除选中边", async () => {
  await h.openCanvasRow(page!, "EDGE");
  const before = (await h.edgeModel(page!)).length;
  await h.selectEdge(page!);
  await page!.getByTitle("删除连线").first().click();
  await expect.poll(async () => (await h.edgeModel(page!)).length).toBe(before - 1);
});
