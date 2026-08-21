import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/** 选择与选区：单击 / 多选 / 框选 / 清空 / 空格平移。 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-sel",
    title: "SEL",
    elements: [
      { id: "s1", kind: "text", props: { text: "ONE" }, x: 100, y: 100, width: 140, height: 90 },
      { id: "s2", kind: "text", props: { text: "TWO" }, x: 420, y: 180, width: 140, height: 90 },
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

test("@CV-X6-SEL-001 单击选中节点出现操作条且无选区工具条", async () => {
  await h.openCanvasRow(page!, "SEL");
  await h.clickNode(page!, "s1");
  await expect
    .poll(async () =>
      h
        .nodeInGraph(page!, "s1")
        .first()
        .evaluate((el) => el.classList.contains("ring-ring")),
    )
    .toBe(true);
  await expect(page!.getByTitle("选择颜色").first()).toBeVisible();
  await expect(page!.getByTestId("canvas-selection-toolbar")).toHaveCount(0);
});

test("@CV-X6-SEL-003 ⌘/Ctrl 加点击多选节点", async () => {
  await h.openCanvasRow(page!, "SEL");
  await h.clickNode(page!, "s1");
  const second = h.nodeInGraph(page!, "s2").first();
  const box = (await second.boundingBox())!;
  await page!.keyboard.down("Meta");
  await page!.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page!.keyboard.up("Meta");
  await page!.waitForTimeout(250);
  await expect(page!.getByTestId("canvas-selection-toolbar")).toBeVisible();
  await expect(page!.getByTestId("canvas-graph").first().getByTitle("选择颜色")).toHaveCount(0);
});

test("@CV-X6-SEL-004 空白处拖拽框选多个节点", async () => {
  await h.openCanvasRow(page!, "SEL");
  const boxes = await h.nodeBoxes(page!, ["s1", "s2"]);
  await h.boxSelect(page!, boxes);
  await expect(page!.getByTestId("canvas-selection-toolbar")).toBeVisible();
});

test("@CV-X6-SEL-005 点击空白清空选区", async () => {
  await h.openCanvasRow(page!, "SEL");
  const graphBox = (await page!.getByTestId("canvas-graph").first().boundingBox())!;
  await page!.mouse.click(graphBox.x + graphBox.width / 2, graphBox.y + 30);
  await page!.waitForTimeout(150);
  await expect(page!.getByTestId("canvas-selection-toolbar")).toHaveCount(0);
  await expect
    .poll(async () =>
      h
        .nodeInGraph(page!, "s1")
        .first()
        .evaluate((el) => el.classList.contains("ring-ring")),
    )
    .toBe(false);
});
