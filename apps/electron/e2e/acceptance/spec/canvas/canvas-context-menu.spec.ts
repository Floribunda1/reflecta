import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * 选择命令（右键菜单 / 选区工具条）：多选删除、节点右键操作、空白粘贴、边删除、重复、置顶置底。
 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

const graphNodes = () => page!.getByTestId("canvas-graph").first().getByTestId("canvas-text-card");

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-ctx",
    title: "CTX",
    elements: [
      { id: "c_a", kind: "text", props: { text: "ONE" }, x: 100, y: 100, width: 140, height: 90 },
      { id: "c_b", kind: "text", props: { text: "TWO" }, x: 420, y: 180, width: 140, height: 90 },
      { id: "c_c", kind: "text", props: { text: "THREE" }, x: 900, y: 340, width: 140, height: 90 },
    ],
    edges: [],
    viewport: null,
  });
  // 置顶 / 置底用独立画布（zIndex 断言需要干净叠放关系）
  seedCanvas({
    id: "cvx-z",
    title: "ZORD",
    elements: [
      { id: "z_lo", kind: "text", props: { text: "LOW" }, x: 200, y: 150, width: 180, height: 110 },
      {
        id: "z_hi",
        kind: "text",
        props: { text: "HIGH" },
        x: 200,
        y: 150,
        width: 180,
        height: 110,
      },
    ],
    edges: [],
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

test("@CV-SEL-006 选区工具条删除多选节点且可撤销", async () => {
  await h.openCanvasRow(page!, "CTX");
  const gb = await h.nodeBoxes(page!, ["c_a", "c_b"]);
  await h.boxSelect(page!, gb);
  await expect(page!.getByTestId("canvas-selection-delete-button")).toBeVisible();
  await page!.getByTestId("canvas-selection-delete-button").click();
  await expect.poll(() => h.graphNodeCount(page!)).toBe(1);
  await page!.keyboard.press("Meta+z");
  await expect.poll(() => h.graphNodeCount(page!)).toBe(3);
});

test("@CV-SEL-007 节点右键菜单提供组织与删除操作", async () => {
  await h.openCanvasRow(page!, "CTX");
  await h.nodeInGraph(page!, "c_c").first().click({ button: "right" });
  for (const id of ["to-front", "to-back", "copy", "duplicate", "delete"]) {
    await expect(page!.getByTestId(`canvas-context-${id}`)).toBeVisible();
  }
  await page!.keyboard.press("Escape");
});

test("@CV-SEL-008 右键粘贴在指针位置", async () => {
  await h.openCanvasRow(page!, "CTX");
  const countBefore = await h.graphNodeCount(page!);
  await h.clickNode(page!, "c_c");
  await page!.keyboard.press("Meta+c");
  const graphBox = (await page!.getByTestId("canvas-graph").first().boundingBox())!;
  // 空白处右键（远离节点），粘贴到该点
  const pasteX = graphBox.x + graphBox.width - 120;
  const pasteY = graphBox.y + 60;
  await page!.mouse.click(pasteX, pasteY, { button: "right" });
  await page!.getByTestId("canvas-context-paste").click();
  await expect.poll(() => h.graphNodeCount(page!)).toBe(countBefore + 1);
  // 副本落在右键点击位置附近（top-left 对齐右键点）
  await expect
    .poll(async () => {
      const boxes = await page!
        .getByTestId("canvas-graph")
        .first()
        .getByTestId("canvas-text-card")
        .all();
      for (const box of boxes) {
        const b = await box.boundingBox();
        if (b && Math.abs(b.x - pasteX) < 24 && Math.abs(b.y - pasteY) < 24) return true;
      }
      return false;
    })
    .toBe(true);
});

test("@CV-SEL-009 边右键菜单删除连线", async () => {
  await h.openCanvasRow(page!, "CTX");
  // 先建立一条边（真实验收入口）
  const from = (await h.portCenter(page!, "c_a", "right"))!;
  const to = (await h.portCenter(page!, "c_b", "left"))!;
  await page!.mouse.move(from.x - 2, from.y);
  await page!.mouse.down();
  await page!.mouse.move(to.x + 2, to.y, { steps: 10 });
  await page!.mouse.up();
  await page!.waitForTimeout(300);
  await expect.poll(async () => (await h.edgeModel(page!)).length).toBe(1);
  const point = await h.edgeMidpointScreen(page!);
  expect(point).not.toBeNull();
  await page!.mouse.click(point!.x, point!.y, { button: "right" });
  await page!.getByTestId("canvas-context-delete-edge").click();
  await expect.poll(async () => (await h.edgeModel(page!)).length).toBe(0);
});

test("@CV-SEL-010 右键「重复」复制节点", async () => {
  await h.openCanvasRow(page!, "CTX");
  const countBefore = await h.graphNodeCount(page!);
  await h.nodeInGraph(page!, "c_a").first().click({ button: "right" });
  await page!.getByTestId("canvas-context-duplicate").click();
  await page!.waitForTimeout(250);
  await expect.poll(() => h.graphNodeCount(page!)).toBe(countBefore + 1);
  await expect(graphNodes().filter({ hasText: "ONE" })).toHaveCount(2);
});

test("@CV-SEL-011 置顶 / 置底调整叠放顺序", async () => {
  await h.openCanvasRow(page!, "ZORD");
  const zIndex = (id: string) =>
    page!.evaluate((nodeId) => {
      const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
      const n = g?.getCellById(nodeId);
      return n?.isNode() ? n.getZIndex() : null;
    }, id);
  // 置顶 LOW
  await h.nodeInGraph(page!, "z_lo").first().click({ button: "right" });
  await page!.getByTestId("canvas-context-to-front").click();
  await expect.poll(async () => (await zIndex("z_lo"))! > (await zIndex("z_hi"))!).toBe(true);
  // 置底 HIGH → 恢复 LOW 在下
  await h.nodeInGraph(page!, "z_hi").first().click({ button: "right" });
  await page!.getByTestId("canvas-context-to-back").click();
  await expect.poll(async () => (await zIndex("z_lo"))! < (await zIndex("z_hi"))!).toBe(true);
});
