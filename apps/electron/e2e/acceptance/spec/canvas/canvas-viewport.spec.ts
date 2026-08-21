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

test("@CV-X6-VIEW-005 无已存视口时初始适应视图", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const v = await h.graphViewport(page!);
  expect(v && v.zoom).toBeLessThan(1.01);
});

test("@CV-X6-VIEW-004 拖动节点吸附到 10px 网格", async () => {
  await h.openCanvasRow(page!, "VIEW");
  await h.dragNodeBy(page!, "v_a", 37, 23);
  const pos = await h.nodeGeometry(page!, "v_a");
  expect(pos && pos.x % 10).toBe(0);
  expect(pos && pos.y % 10).toBe(0);
});

test("@CV-X6-VIEW-001 中键拖拽平移画布", async () => {
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

test("@CV-X6-VIEW-002 滚动滚轮缩放画布", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const before = await h.waitViewport(page!);
  const box = await graphBox();
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page!.mouse.wheel(0, -240);
  await page!.waitForTimeout(200);
  const after = await h.graphViewport(page!);
  expect(after && after.zoom).toBeGreaterThan(before!.zoom);
});

test("@CV-X6-VIEW-003 左下缩放控件调整视口", async () => {
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

test("@CV-X6-VIEW-006 已存视口重进后保持", async () => {
  await h.openCanvasRow(page!, "VIEW");
  const box = await graphBox();
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page!.mouse.wheel(0, -240);
  await page!.waitForTimeout(1000);
  const saved = await h.graphViewport(page!);
  await h.openCanvasRow(page!, "VIEW");
  await expect
    .poll(async () => (await h.graphViewport(page!))?.zoom, { timeout: 8000 })
    .toBeCloseTo(saved!.zoom, 2);
});
