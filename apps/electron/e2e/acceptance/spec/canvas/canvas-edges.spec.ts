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
  seedCanvas({
    id: "cvx-edge-parallel",
    title: "PARALLEL",
    elements: [
      { id: "pa_a", kind: "text", props: { text: "A" }, x: 100, y: 150, width: 120, height: 80 },
      { id: "pa_b", kind: "text", props: { text: "B" }, x: 420, y: 150, width: 120, height: 80 },
      { id: "pa_c", kind: "text", props: { text: "C" }, x: 420, y: 400, width: 120, height: 80 },
    ],
    edges: [],
  });
  seedCanvas({
    id: "cvx-edge-style",
    title: "EDGESTYLE",
    elements: [
      { id: "st_a", kind: "text", props: { text: "A" }, x: 100, y: 150, width: 120, height: 80 },
      { id: "st_b", kind: "text", props: { text: "B" }, x: 420, y: 150, width: 120, height: 80 },
    ],
    edges: [],
  });
  seedCanvas({
    id: "cvx-edge-ports",
    title: "EDGEPORTS",
    elements: [
      { id: "port_a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
      { id: "port_b", kind: "text", props: { text: "B" }, x: 420, y: 400, width: 120, height: 80 },
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

async function connectAToB(offsetY = 0, fromId = "e_a", toId = "e_b") {
  const from = (await h.portCenter(page!, fromId, "right"))!;
  const to = (await h.portCenter(page!, toId, "left"))!;
  await page!.mouse.move(from.x - 2, from.y + offsetY);
  await page!.mouse.down();
  await page!.mouse.move(to.x + 2, to.y + offsetY, { steps: 10 });
  await page!.mouse.up();
  await page!.waitForTimeout(300);
}

async function connectBottomToTop(fromId: string, toId: string) {
  const from = (await h.portCenter(page!, fromId, "bottom"))!;
  const to = (await h.portCenter(page!, toId, "top"))!;
  await page!.mouse.move(from.x, from.y - 2);
  await page!.mouse.down();
  await page!.mouse.move(to.x, to.y + 2, { steps: 10 });
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

test("@CV-X6-EDGE-003 新连线自带画布归属与默认 X6 配置", async () => {
  await h.openCanvasRow(page!, "EDGE");
  const edges = await h.edgeModel(page!);
  expect(edges[0].canvasId).toBe("cvx-edge");
  expect(edges[0].router).toBe("reflecta-curve");
  expect(edges[0].connector).toBe("reflecta-curve");
});

test("@CV-X6-EDGE-002 同一节点可连不同端点", async () => {
  await h.openCanvasRow(page!, "PARALLEL");
  await page!.waitForTimeout(600);
  await connectAToB(-1, "pa_a", "pa_b"); // A→B
  await connectAToB(1, "pa_a", "pa_c"); // A→C
  await expect.poll(async () => (await h.edgeModel(page!)).length).toBe(2);
  const edges = await h.edgeModel(page!);
  expect(edges.map((e) => e.source)).toEqual(["pa_a", "pa_a"]);
  const endpoint = (await h.edgeEndpoint(page!, "pa_c"))!;
  const targetPort = (await h.portCenter(page!, "pa_c", "left"))!;
  expect(Math.abs(endpoint.y - targetPort.y)).toBeLessThan(2);
});

test("@CV-X6-PERSIST-003 多出边重载不丢失", async () => {
  await h.openCanvasRow(page!, "PARALLEL");
  await expect.poll(async () => (await h.edgeModel(page!)).length).toBe(2);
  const edges = await h.edgeModel(page!);
  expect(edges.map((e) => e.source)).toEqual(["pa_a", "pa_a"]);
  expect(edges.map((e) => e.target)).toEqual(expect.arrayContaining(["pa_b", "pa_c"]));
});

test("@CV-X6-EDGE-008 用户选择的连接端口在重新进入后保持", async () => {
  await h.openCanvasRow(page!, "EDGEPORTS");
  await connectBottomToTop("port_a", "port_b");
  await expect.poll(async () => (await h.edgeModel(page!))[0]?.sourcePort).toBe("bottom");
  expect((await h.edgeModel(page!))[0]?.targetPort).toBe("top");
  await h.dragNodeBy(page!, "port_a", -80, 40);
  expect((await h.edgeModel(page!))[0]?.sourcePort).toBe("bottom");
  expect((await h.edgeModel(page!))[0]?.targetPort).toBe("top");
  await page!.waitForTimeout(1200);
  await h.openCanvasRow(page!, "EDGEPORTS");
  await expect.poll(async () => (await h.edgeModel(page!))[0]?.sourcePort).toBe("bottom");
  expect((await h.edgeModel(page!))[0]?.targetPort).toBe("top");
});

test("@CV-X6-EDGE-004 调整连线样式并保留", async () => {
  await h.openCanvasRow(page!, "EDGESTYLE");
  await connectAToB(0, "st_a", "st_b");
  await h.selectEdge(page!);
  await expect(page!.getByTestId("canvas-edge-toolbar")).toBeVisible();
  await page!.getByTitle("颜色").first().click();
  await page!.locator("button[title='chart-1']").first().click();
  await page!.waitForTimeout(300);
  await page!.getByTitle("路径").click();
  await page!.getByText("正交", { exact: true }).first().click();
  await page!.getByTitle("线型").click();
  await page!.getByText("虚线", { exact: true }).first().click();
  await page!.getByTitle("线宽").click();
  await page!.getByText("粗", { exact: true }).first().click();
  await page!.getByTitle("箭头").click();
  await page!.getByText("圆点", { exact: true }).first().click();
  await page!.waitForTimeout(1200); // 等防抖(800ms)保存落库再重开
  const s1 = await h.edgeModel(page!);
  expect(s1[0].strokeToken).toBe("var(--chart-1)");
  expect(s1[0].router).toBe("manhattan");
  expect(s1[0].routerArgs).toEqual({
    startDirections: ["right"],
    endDirections: ["left"],
    padding: 16,
  });
  expect(s1[0].connector).toBe("rounded");
  expect(s1[0].dasharray).toBe("5 5");
  expect(s1[0].strokeWidth).toBe(4);
  expect(s1[0].marker).toBe("circle");
  await h.openCanvasRow(page!, "EDGESTYLE");
  await expect.poll(async () => (await h.edgeModel(page!))[0]?.strokeToken).toBe("var(--chart-1)");
  const s2 = await h.edgeModel(page!);
  expect(s2[0].router).toBe("manhattan");
  expect(s2[0].routerArgs).toEqual(s1[0].routerArgs);
  expect(s2[0].connector).toBe("rounded");
  expect(s2[0].marker).toBe("circle");
});

test("@CV-X6-EDGE-005 双击边就地编辑标签并提交", async () => {
  await h.openCanvasRow(page!, "EDGESTYLE");
  await connectAToB(0, "st_a", "st_b");
  await h.selectEdge(page!);
  const input = page!.getByTestId("canvas-edge-label");
  await expect(input).toHaveCount(0); // 未双击前不出现输入框
  await h.dblclickEdge(page!);
  await expect(input).toBeVisible();
  await page!.keyboard.type("EDGE_LABEL");
  await page!.keyboard.press("Enter");
  await page!.waitForTimeout(1200); // 等防抖(800ms)保存落库再重开
  await h.openCanvasRow(page!, "EDGESTYLE");
  await h.selectEdge(page!); // 重开不保留选中，先选中边再断言标签
  await h.dblclickEdge(page!);
  await expect(page!.getByTestId("canvas-edge-label").first()).toHaveValue("EDGE_LABEL", {
    timeout: 8000,
  });
});

test("@CV-X6-EDGE-006 清空边标签回到无标签", async () => {
  await h.openCanvasRow(page!, "EDGE");
  await h.selectEdge(page!);
  await h.dblclickEdge(page!);
  const input = page!.getByTestId("canvas-edge-label");
  await expect(input).toBeVisible();
  await page!.keyboard.type("TO_CLEAR");
  await page!.keyboard.press("Enter");
  await page!.waitForTimeout(1200); // 先落一个标签，再验证清空路径
  await h.openCanvasRow(page!, "EDGE");
  await h.selectEdge(page!);
  await h.dblclickEdge(page!);
  await expect(input).toBeVisible();
  await page!.keyboard.press("End");
  for (let i = 0; i < 10; i++) await page!.keyboard.press("Backspace");
  await page!.keyboard.press("Enter");
  await page!.waitForTimeout(1200); // 等防抖(800ms)保存落库
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
