import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/** 编辑辅助：History 撤销创建/移动、Clipboard 复制粘贴、Snapline、MiniMap。 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-aux",
    title: "AUX",
    elements: [
      { id: "x_a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 140, height: 90 },
      { id: "x_b", kind: "text", props: { text: "B" }, x: 520, y: 100, width: 140, height: 90 },
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

test("@CV-X6-AUX-001 撤销 / 重做创建与移动", async () => {
  await h.openCanvasRow(page!, "AUX");
  // 撤销创建
  const graphBox = (await page!.getByTestId("canvas-graph").first().boundingBox())!;
  const before = await h.graphNodeCount(page!);
  await h.dragSourceTo(
    page!,
    page!.getByTestId("canvas-tool-dnd-text"),
    graphBox.x + 620,
    graphBox.y + 400,
  );
  await expect.poll(() => h.graphNodeCount(page!)).toBe(before + 1);
  await page!.keyboard.press("Meta+z");
  await expect.poll(() => h.graphNodeCount(page!)).toBe(before);
  await page!.keyboard.press("Meta+Shift+z");
  await expect.poll(() => h.graphNodeCount(page!)).toBe(before + 1);
  // 撤销移动
  await h.clickNode(page!, "x_a");
  await page!.waitForTimeout(150);
  const pos0 = await h.nodeGeometry(page!, "x_a");
  await h.dragNodeBy(page!, "x_a", 90, 40);
  const pos1 = await h.nodeGeometry(page!, "x_a");
  expect(pos1 && pos1.x).toBeGreaterThan(pos0!.x + 40);
  await page!.keyboard.press("Meta+z");
  await expect.poll(async () => h.nodeGeometry(page!, "x_a")).toEqual(pos0);
  await page!.keyboard.press("Meta+Shift+z");
  await expect.poll(async () => h.nodeGeometry(page!, "x_a")).toEqual(pos1);
});

test("@CV-X6-AUX-003 复制并粘贴节点", async () => {
  await h.openCanvasRow(page!, "AUX");
  const before = await h.graphNodeCount(page!);
  await h.clickNode(page!, "x_a");
  await page!.keyboard.press("Meta+c");
  await page!.keyboard.press("Meta+v");
  await expect.poll(() => h.graphNodeCount(page!)).toBe(before + 1);
});

test("@CV-X6-AUX-004 拖动时出现对齐参考线", async () => {
  await h.openCanvasRow(page!, "AUX");
  const source = (await h.nodeInGraph(page!, "x_a").first().boundingBox())!;
  const target = (await h.nodeInGraph(page!, "x_b").first().boundingBox())!;
  await page!.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page!.mouse.down();
  await page!.mouse.move(target.x + target.width / 2 - 120, target.y + target.height / 2, {
    steps: 10,
  });
  await expect
    .poll(
      () =>
        page!
          .locator(".x6-widget-snapline")
          .first()
          .isVisible()
          .catch(() => false),
      {
        timeout: 3000,
        intervals: [100],
      },
    )
    .toBe(true);
  await page!.mouse.up();
  await page!.waitForTimeout(150);
});

test("@CV-X6-AUX-005 缩略图出现且可平移主画布", async () => {
  await h.openCanvasRow(page!, "AUX");
  const mm = page!.locator(".x6-widget-minimap").first();
  await expect(mm).toBeVisible();
  const v0 = await h.waitViewport(page!);
  const mb = (await mm.boundingBox())!;
  await page!.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
  await page!.mouse.down();
  await page!.mouse.move(mb.x + mb.width / 2 + 40, mb.y + mb.height / 2 + 30, { steps: 6 });
  await page!.mouse.up();
  await page!.waitForTimeout(200);
  const v1 = await h.graphViewport(page!);
  expect(Math.abs(v1!.x - v0!.x) + Math.abs(v1!.y - v0!.y)).toBeGreaterThan(10);
});
