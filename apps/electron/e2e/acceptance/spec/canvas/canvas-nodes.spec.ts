import { expect, test } from "@playwright/test";
import {
  deleteUnderstanding,
  resetAgentFixtures,
  seedCanvas,
  seedUnderstanding,
  seedUnderstandingIdByTitle,
} from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * 卡片（文本 / 理解 / 画布引用）展示与编辑 + 空画布引导。
 * 从理解库 / 画布库「拖入创建」的入口验收在 canvas-library.spec.ts。
 * 每个场景先重新进入对应画布（从 DB 取状态），串行单 app 实例。
 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

const textCards = () => page!.getByTestId("canvas-graph").first().getByTestId("canvas-text-card");

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
  // CARD-001 的拖入卡与编辑场景共用画布会把卡落到编辑点击点上：独立画布
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
  // 正常理解卡：引用 baseline 的 React Server Components
  seedCanvas({
    id: "cvx-undfull",
    title: "UNDFULL",
    elements: [
      {
        id: "u_f",
        kind: "understanding",
        understandingId: seedUnderstandingIdByTitle("React Server Components"),
        props: {},
        x: 100,
        y: 100,
        width: 260,
        height: 160,
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
  // 引用卡（内嵌预览 / 双击跳转）：REFV 预置一张引用 cvx-target 的引用卡
  seedCanvas({
    id: "cvx-refv",
    title: "REFV",
    elements: [
      {
        id: "rv_r",
        kind: "canvas_ref",
        canvasRefId: "cvx-target",
        props: {},
        x: 100,
        y: 100,
        width: 220,
        height: 140,
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
  seedCanvas({ id: "cvx-empty", title: "EMPTYCV", elements: [], viewport: null });
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

test("@CV-CARD-001 拖拽工具栏文本按钮创建文本卡", async () => {
  await h.openCanvasRow(page!, "TEXTDND");
  const graph = page!.getByTestId("canvas-graph").first();
  const box = (await graph.boundingBox())!;
  await h.dragSourceTo(page!, page!.getByTestId("canvas-tool-dnd-text"), box.x + 560, box.y + 320);
  await expect(textCards()).toHaveCount(2);
});

test("@CV-CARD-002 双击进入 Markdown 编辑，失焦提交并保留", async () => {
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

test("@CV-CARD-003 文本编辑中按 Escape 提交改动", async () => {
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

test("@CV-CARD-004 设置并清除卡片颜色", async () => {
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

test("@CV-CARD-006 拖动缩放手柄调整尺寸并持久化", async () => {
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

test("@CV-CARD-005 从卡片操作菜单删除文本卡", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const before = await h.graphNodeCount(page!);
  const card = h.nodeInGraph(page!, "t_a").first();
  await card.click();
  await page!.getByLabel("删除").first().click();
  await expect.poll(() => h.graphNodeCount(page!)).toBe(before - 1);
});

test("@CV-PERSIST-001 节点位置与尺寸重载一致", async () => {
  await h.openCanvasRow(page!, "TEXT");
  const before = await h.nodeGeometry(page!, "t_a");
  await h.openCanvasRow(page!, "TEXT");
  await expect.poll(async () => h.nodeGeometry(page!, "t_a")).toEqual(before);
});

test("@CV-CARD-021 空画布显示创建引导", async () => {
  await h.openCanvasRow(page!, "EMPTYCV");
  await expect(page!.getByText("这张画布还是空的")).toBeVisible();
});

test("@CV-CARD-008 引用已删除理解的理解卡显示占位", async () => {
  await h.openCanvasRow(page!, "UND");
  await expect(h.nodeInGraph(page!, "u_u").first()).toBeVisible();
  await expect(h.nodeInGraph(page!, "u_u").first()).toContainText("（已删除）");
});

test("@CV-CARD-007 理解卡展示引用理解的标题与正文", async () => {
  await h.openCanvasRow(page!, "UNDFULL");
  const card = page!
    .getByTestId("canvas-graph")
    .first()
    .getByTestId("canvas-understanding-card")
    .filter({ hasText: "React Server Components" })
    .first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("React Server Components");
});

test("@CV-CARD-009 点击已知理解卡的编辑按钮打开详情", async () => {
  await h.openCanvasRow(page!, "UNDFULL");
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

test("@CV-CARD-010 双击理解卡打开详情", async () => {
  await h.openCanvasRow(page!, "UNDFULL");
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

test("@CV-CARD-011 引用卡内嵌目标画布的只读预览", async () => {
  await h.openCanvasRow(page!, "REFV");
  const card = page!.getByTestId("canvas-graph").first().getByTestId("canvas-canvas-ref-card");
  await expect(card).toBeVisible();
  await expect(
    card.getByTestId("canvas-text-card").filter({ hasText: "TARGET_NODE" }),
  ).toBeVisible();
});

test("@CV-CARD-012 双击引用卡打开目标画布", async () => {
  await h.openCanvasRow(page!, "REFV");
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

test("@CV-CARD-013 目标画布已删除的引用卡占位且不可跳转", async () => {
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
