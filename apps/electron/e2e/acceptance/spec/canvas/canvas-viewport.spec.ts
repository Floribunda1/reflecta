import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/** 视口 / 网格：中键平移、滚轮缩放、缩放控件、网格吸附、初始/已存视口。 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-view",
    title: "VIEW",
    elements: [
      { id: "v_a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
    ],
    viewport: null,
  });
  seedCanvas({
    id: "cvx-other",
    title: "OTHER",
    elements: [
      { id: "o_a", kind: "text", props: { text: "Other" }, x: 300, y: 200, width: 120, height: 80 },
    ],
    viewport: { x: 321, y: 123, zoom: 0.75 },
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

async function graphBox() {
  return (await page!.getByTestId("canvas-graph").first().boundingBox())!;
}

test("@CV-VIEW-005 无已存视口时初始适应视图", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const v = await h.graphViewport(page!);
  expect(v && v.zoom).toBeLessThan(1.01);
});

test("@CV-VIEW-004 拖动节点吸附到 10px 网格", async () => {
  await h.openCanvasRow(page!, "VIEW");
  await h.dragNodeBy(page!, "v_a", 37, 23);
  const pos = await h.nodeGeometry(page!, "v_a");
  expect(pos && pos.x % 10).toBe(0);
  expect(pos && pos.y % 10).toBe(0);
});

test("@CV-VIEW-001 中键拖拽平移画布", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const before = await h.waitViewport(page!);
  const box = await graphBox();
  await page!.mouse.move(box.x + 400, box.y + 200);
  await page!.mouse.down({ button: "middle" });
  await page!.mouse.move(box.x + 540, box.y + 300, { steps: 8 });
  await page!.mouse.up({ button: "middle" });
  await page!.waitForTimeout(250);
  const after = await h.waitViewport(page!);
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(10);
});

test("@CV-VIEW-002 滚轮平移、⌘/Ctrl+滚轮缩放画布", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const before = await h.waitViewport(page!);
  const box = await graphBox();
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Figma 惯例：滚轮 = 平移（trackpad 插件接管 wheel）
  await page!.mouse.wheel(0, -240);
  await page!.waitForTimeout(200);
  const panned = await h.waitViewport(page!);
  expect(Math.abs(panned.x - before!.x) + Math.abs(panned.y - before!.y)).toBeGreaterThan(10);
  expect(panned.zoom).toBeCloseTo(before!.zoom, 5); // 平移不改变缩放
  // ⌘+滚轮 = 缩放（光标为锚点）
  await page!.keyboard.down("Meta");
  await page!.mouse.wheel(0, -240);
  await page!.keyboard.up("Meta");
  await page!.waitForTimeout(200);
  const after = await h.graphViewport(page!);
  expect(after && after.zoom).toBeGreaterThan(before!.zoom);
});

test("@CV-VIEW-003 左下缩放控件调整视口", async () => {
  await h.openCanvasRow(page!, "VIEW");
  await expect(page!.getByTestId("canvas-zoom-fit")).toBeVisible();
  await page!.getByTestId("canvas-zoom-fit").click(); // 归一化起点
  await page!.waitForTimeout(250);
  const v0 = await h.waitViewport(page!);
  await page!.getByTestId("canvas-zoom-in").click();
  await page!.waitForTimeout(200);
  const v1 = await h.graphViewport(page!);
  expect(v1 && v1.zoom).toBeGreaterThan(v0!.zoom);
  await page!.getByTestId("canvas-zoom-out").click();
  await page!.waitForTimeout(200);
  const v2 = await h.graphViewport(page!);
  expect(v2 && v2.zoom).toBeLessThan(v1!.zoom);
  await expect(page!.getByTestId("canvas-zoom-fit")).toBeVisible();
  await page!.getByTestId("canvas-zoom-fit").click();
  await page!.waitForTimeout(200);
  await expect(page!.getByTestId("canvas-graph").first()).toBeVisible();
});

test("@CV-VIEW-006 已存视口重进后保持", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const box = await graphBox();
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page!.keyboard.down("Meta");
  await page!.mouse.wheel(0, -240);
  await page!.keyboard.up("Meta");
  await page!.waitForTimeout(1000);
  const saved = await h.graphViewport(page!);
  await h.openCanvasRow(page!, "VIEW");
  await expect
    .poll(async () => (await h.graphViewport(page!))?.zoom, { timeout: 8000 })
    .toBeCloseTo(saved!.zoom, 2);
});

test("@CV-VIEW-007 切换画布后恢复各自视口", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const box = await graphBox();
  await page!.mouse.move(box.x + 400, box.y + 200);
  await page!.mouse.down({ button: "middle" });
  await page!.mouse.move(box.x + 520, box.y + 280, { steps: 8 });
  await page!.mouse.up({ button: "middle" });
  await page!.getByTestId("canvas-zoom-in").click();
  await page!.waitForTimeout(1000);
  const viewBeforeSwitch = await h.waitViewport(page!);

  await h.openCanvasRow(page!, "OTHER");
  const other = await h.waitViewport(page!);
  expect(other?.x).toBeCloseTo(321, 1);
  expect(other?.y).toBeCloseTo(123, 1);
  expect(other?.zoom).toBeCloseTo(0.75, 2);

  await h.openCanvasRow(page!, "VIEW");
  const view = await h.waitViewport(page!);
  expect(view?.x).toBeCloseTo(viewBeforeSwitch!.x, 1);
  expect(view?.y).toBeCloseTo(viewBeforeSwitch!.y, 1);
  expect(view?.zoom).toBeCloseTo(viewBeforeSwitch!.zoom, 2);
});
