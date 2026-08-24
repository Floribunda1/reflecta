import { expect, test } from "@playwright/test";
import {
  deleteUnderstanding,
  resetAgentFixtures,
  seedCanvas,
  seedUnderstanding,
} from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * 节点卡片（文本 / 理解 / 画布引用）+ 初始适应视图。
 * 每个场景先重新进入对应画布（从 DB 取状态），串行单 app 实例。
 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

const textCards = () => page!.getByTestId("canvas-graph").first().getByTestId("canvas-text-card");
const RSC_ITEM =
  '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]';

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-text",
    title: "TEXT",
    elements: [
      { id: "t_a", kind: "text", props: { text: "hello" }, x: 100, y: 100, width: 180, height: 90 },
    ],
    viewport: null,
  });
  // TEXT-001 的拖入卡与编辑场景共用画布会把卡落到编辑点击点上：独立画布
  seedCanvas({
    id: "cvx-textdnd",
    title: "TEXTDND",
    elements: [
      {
        id: "td_a",
        kind: "text",
        props: { text: "hello" },
        x: 100,
        y: 100,
        width: 180,
        height: 90,
      },
    ],
    viewport: null,
  });
  // 占位卡引用一张“真实存在但已删除”的理解（校验只查存在性；假 id 会拒存整个画布）
  seedUnderstanding({ id: "th_seed_deleted", title: "DELETED_UND", body: "deleted body" });
  deleteUnderstanding("th_seed_deleted");
  seedCanvas({
    id: "cvx-und",
    title: "UND",
    elements: [
      {
        id: "u_u",
        kind: "understanding",
        understandingId: "th_seed_deleted",
        props: {},
        x: 100,
        y: 100,
        width: 220,
        height: 140,
      },
    ],
  });
  seedCanvas({ id: "cvx-ref", title: "REF", elements: [] });
  seedCanvas({
    id: "cvx-target",
    title: "TARGET",
    elements: [
      {
        id: "tg_t",
        kind: "text",
        props: { text: "TARGET_NODE" },
        x: 10,
        y: 10,
        width: 140,
        height: 90,
      },
    ],
  });
  seedCanvas({
    id: "cvx-rgh",
    title: "REFGHOST",
    elements: [
      {
        id: "r_r",
        kind: "canvas_ref",
        canvasRefId: "ghost_canvas_missing",
        props: {},
        x: 100,
        y: 100,
        width: 220,
        height: 140,
      },
    ],
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

test("@CV-X6-VIEW-005 无已存视口时初始适应视图", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const v = await h.graphViewport(page!);
  expect(v && v.zoom).toBeLessThan(1.01);
});

test("@CV-X6-TEXT-001 拖拽工具栏文本按钮创建文本卡", async () => {
  await h.openCanvasRow(page!, "TEXTDND");
  const graph = page!.getByTestId("canvas-graph").first();
  const box = (await graph.boundingBox())!;
  await h.dragSourceTo(page!, page!.getByTestId("canvas-tool-dnd-text"), box.x + 560, box.y + 320);
  await expect(textCards()).toHaveCount(2);
});

test("@CV-X6-TEXT-002 双击进入 Markdown 编辑，失焦提交并保留", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const card = h.nodeInGraph(page!, "t_a").first();
  await card.click({ clickCount: 2 });
  await expect(card.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true", {
    timeout: 8000,
  });
  await card.locator(".ProseMirror").click({ position: { x: 15, y: 15 } });
  await page!.keyboard.press("Meta+a");
  await page!.keyboard.type("hello world");
  await page!.mouse.click(600, 30); // 失焦（点击空白处）
  await expect(card).toContainText("hello world");
});

test("@CV-X6-TEXT-003 文本编辑中按 Escape 提交改动", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const card = h.nodeInGraph(page!, "t_a").first();
  await card.click({ clickCount: 2 });
  await card.locator(".ProseMirror").click({ position: { x: 15, y: 15 } });
  await page!.keyboard.press("Meta+a");
  await page!.keyboard.type("ESCAPED_TEXT");
  await page!.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-editing", "false");
  await expect(card).toContainText("ESCAPED_TEXT");
});

test("@CV-X6-TEXT-004 设置并清除卡片颜色", async () => {
  await h.openCanvasRow(page!, "TEXT");
  await h.clickNode(page!, "t_a");
  const card = h.nodeInGraph(page!, "t_a").first();
  await expect(page!.getByTitle("选择颜色").first()).toBeVisible();
  await page!.getByTitle("选择颜色").first().click();
  await page!.locator("button[title='chart-1']").first().click();
  await page!.waitForTimeout(400);
  await expect.poll(async () => h.borderColorOf(page!, card)).toBe("rgb(71, 158, 194)");
  await page!.getByTitle("选择颜色").first().click();
  await page!.getByTitle("清除颜色").click();
  await page!.waitForTimeout(400);
  expect(await h.borderColorOf(page!, card)).not.toBe("rgb(71, 158, 194)");
});

test("@CV-X6-TEXT-006 拖动缩放手柄调整尺寸并持久化", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const card = h.nodeInGraph(page!, "t_a").first();
  await card.click();
  await page!.waitForTimeout(250);
  const handle = page!.locator('[data-position="bottom-right"]');
  await expect(handle.first()).toBeVisible();
  const hb = (await handle.first().boundingBox())!;
  await page!.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page!.mouse.down();
  await page!.mouse.move(hb.x + 60, hb.y + 40, { steps: 8 });
  await page!.mouse.up();
  await page!.waitForTimeout(250);
  const size = await h.nodeGeometry(page!, "t_a");
  expect(size && size.width).toBeGreaterThan(200);
});

test("@CV-X6-TEXT-005 从卡片操作菜单删除文本卡", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const before = await h.graphNodeCount(page!);
  const card = h.nodeInGraph(page!, "t_a").first();
  await card.click();
  await page!.getByLabel("删除").first().click();
  await expect.poll(() => h.graphNodeCount(page!)).toBe(before - 1);
});

test("@CV-X6-PERSIST-001 节点位置与尺寸重载一致", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const before = await h.nodeGeometry(page!, "t_a");
  await h.openCanvasRow(page!, "TEXT");
  await expect.poll(async () => h.nodeGeometry(page!, "t_a")).toEqual(before);
});

test("@CV-X6-UND-002 引用理解已删除的理解卡显示占位", async () => {
  await h.openCanvasRow(page!, "UND");
  await expect(h.nodeInGraph(page!, "u_u").first()).toBeVisible();
  await expect(h.nodeInGraph(page!, "u_u").first()).toContainText("（已删除）");
});

test("@CV-X6-UND-001 从理解库拖拽创建理解卡并看到全文", async () => {
  await h.openCanvasRow(page!, "UND");
  await h.openLibrary(page!);
  const graphBox = (await page!.getByTestId("canvas-graph").first().boundingBox())!;
  const row = page!.locator(RSC_ITEM);
  await expect(row).toBeVisible();
  await h.dragSourceTo(page!, row, graphBox.x + 140, graphBox.y + 420);
  const card = page!
    .getByTestId("canvas-graph")
    .first()
    .getByTestId("canvas-understanding-card")
    .filter({ hasText: "React Server Components" });
  await expect(card.first()).toBeVisible();
  // 点击选中不打开详情
  await h.clickNode(page!, (await card.first().getAttribute("data-node-id"))!);
  await expect(page!.getByTestId("canvas-detail-panel")).toHaveCount(0);
});

test("@CV-X6-UND-003 点击已知理解卡的编辑按钮打开详情", async () => {
  await h.openCanvasRow(page!, "UND");
  const card = page!
    .getByTestId("canvas-graph")
    .first()
    .getByTestId("canvas-understanding-card")
    .filter({ hasText: "React Server Components" })
    .first();
  await card.click();
  await expect(page!.getByTestId("canvas-detail-panel")).toHaveCount(0);
  await card.locator('button[aria-label="编辑"]').click();
  await expect(page!.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });
  await page!.getByTestId("canvas-detail-panel").getByLabel("关闭详情").click();
  await expect(page!.getByTestId("canvas-detail-panel")).toHaveCount(0);
});

test("@CV-X6-UND-004 双击理解卡打开详情", async () => {
  await h.openCanvasRow(page!, "UND");
  const card = page!
    .getByTestId("canvas-graph")
    .first()
    .getByTestId("canvas-understanding-card")
    .filter({ hasText: "React Server Components" })
    .first();
  await card.click({ clickCount: 2 });
  await expect(page!.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });
  await page!.getByTestId("canvas-detail-panel").getByLabel("关闭详情").click();
});

test("@CV-X6-REF-001 创建引用卡并看到内嵌只读预览", async () => {
  await h.openCanvasRow(page!, "REF");
  await h.openLibrary(page!);
  await page!.getByRole("tab", { name: "画布" }).click();
  await page!.getByTestId("canvas-library-canvas-item").filter({ hasText: "TARGET" }).click();
  await page!.waitForTimeout(500);
  const card = page!.getByTestId("canvas-graph").first().getByTestId("canvas-canvas-ref-card");
  await expect(card).toBeVisible();
  await expect(
    card.getByTestId("canvas-text-card").filter({ hasText: "TARGET_NODE" }),
  ).toBeVisible();
});

test("@CV-X6-REF-002 双击引用卡打开目标画布", async () => {
  await h.openCanvasRow(page!, "REF");
  const card = page!
    .getByTestId("canvas-graph")
    .first()
    .getByTestId("canvas-canvas-ref-card")
    .first();
  await expect(card).toBeVisible();
  await card.click({ clickCount: 2 });
  await expect(page!.getByTestId("canvas-workspace")).toBeVisible();
  await expect(
    page!
      .getByTestId("canvas-graph")
      .first()
      .getByTestId("canvas-text-card")
      .filter({ hasText: "TARGET_NODE" }),
  ).toBeVisible();
});

test("@CV-X6-REF-003 目标画布已删除的引用卡占位且不可跳转", async () => {
  await h.openCanvasRow(page!, "REFGHOST");
  const card = page!.getByTestId("canvas-graph").first().getByTestId("canvas-canvas-ref-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("（已删除）");
  await card.click({ clickCount: 2 });
  await page!.waitForTimeout(400);
  await expect(
    page!.getByTestId("canvas-graph").first().getByTestId("canvas-canvas-ref-card"),
  ).toBeVisible();
});
