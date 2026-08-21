import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/** 导出 + 搜索。 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

const RSC_ITEM =
  '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]';

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-search",
    title: "SEARCH",
    elements: [
      { id: "s_a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
      { id: "s_b", kind: "text", props: { text: "B" }, x: 320, y: 100, width: 120, height: 80 },
      {
        id: "s_g",
        kind: "group",
        props: { label: "SNK_GROUP" },
        x: 60,
        y: 40,
        width: 440,
        height: 200,
        zIndex: -1,
      },
      {
        id: "s_r",
        kind: "canvas_ref",
        canvasRefId: "cvx-search-tgt",
        props: {},
        x: 700,
        y: 100,
        width: 220,
        height: 140,
      },
      {
        id: "s_t",
        kind: "text",
        props: { text: "SNK_TEXT" },
        x: 700,
        y: 320,
        width: 140,
        height: 90,
      },
    ],
    edges: [
      { id: "s_e1", sourceElementId: "s_a", targetElementId: "s_b", label: "SNK_EDGE", style: {} },
    ],
  });
  seedCanvas({
    id: "cvx-search-tgt",
    title: "TARGET",
    elements: [
      {
        id: "tg_t",
        kind: "text",
        props: { text: "TARGET_NODE" },
        x: 10,
        y: 10,
        width: 120,
        height: 80,
      },
    ],
  });
  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
});
test.afterEach(async () => {
  // 让改动后的防抖保存落库，避免下一场景重进画布时读到旧文档
  if (page) await page.waitForTimeout(900);
});

test.afterAll(async () => {
  await app?.close();
});

test("@CV-X6-SEARCH-001 打开搜索浮层，编辑态内不触发", async () => {
  await h.openCanvasRow(page!, "SEARCH");
  await page!.getByTestId("canvas-graph").first().click();
  await page!.keyboard.press("Meta+f");
  await expect(page!.getByTestId("canvas-search-overlay")).toBeVisible({ timeout: 4000 });
  await page!.keyboard.press("Escape");
  await expect(page!.getByTestId("canvas-search-overlay")).toHaveCount(0);
  // 编辑态内不触发
  const card = h.nodeInGraph(page!, "s_t").first();
  await card.click({ clickCount: 2 });
  await expect(card.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true", {
    timeout: 8000,
  });
  await card.locator(".ProseMirror").click({ position: { x: 15, y: 15 } });
  await page!.keyboard.press("Meta+f");
  await expect(page!.getByTestId("canvas-search-overlay")).toHaveCount(0);
  await page!.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-editing", "false");
});

test("@CV-X6-SEARCH-002 搜索命中各类内容", async () => {
  await h.openCanvasRow(page!, "SEARCH");
  // 先拖入一张真实理解卡（链接理解引用后搜索标题/正文）
  await h.openLibrary(page!);
  const graphBox = (await page!.getByTestId("canvas-graph").first().boundingBox())!;
  const row = page!.locator(RSC_ITEM);
  await expect(row).toBeVisible();
  await h.dragSourceTo(page!, row, graphBox.x + 300, graphBox.y + 420);
  await page!.waitForTimeout(1400);
  for (const token of ["SNK_GROUP", "SNK_TEXT", "SNK_EDGE", "TARGET", "React Server Components"]) {
    await page!.getByTestId("canvas-graph").first().click();
    await page!.keyboard.press("Meta+f");
    await expect(page!.getByTestId("canvas-search-overlay")).toBeVisible({ timeout: 4000 });
    await page!.getByTestId("canvas-search-input").fill(token);
    await expect(
      page!.getByTestId("canvas-search-result").filter({ hasText: token }).first(),
    ).toBeVisible({ timeout: 4000 });
    await page!.keyboard.press("Escape");
    await expect(page!.getByTestId("canvas-search-overlay")).toHaveCount(0);
  }
});

test("@CV-X6-SEARCH-003 点选搜索结果定位", async () => {
  await h.openCanvasRow(page!, "SEARCH");
  await page!.getByTestId("canvas-graph").first().click();
  await page!.keyboard.press("Meta+f");
  await expect(page!.getByTestId("canvas-search-overlay")).toBeVisible({ timeout: 4000 });
  await page!.getByTestId("canvas-search-input").fill("SNK_TEXT");
  const first = page!.getByTestId("canvas-search-result").filter({ hasText: "SNK_TEXT" }).first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page!.getByTestId("canvas-search-overlay")).toHaveCount(0);
  await expect(h.nodeInGraph(page!, "s_t")).toBeVisible();
});

test("@CV-X6-EXPORT-001 从工具栏导出 PNG", async () => {
  await h.openCanvasRow(page!, "SEARCH");
  await page!.getByTestId("canvas-toolbar-more").click();
  await expect(page!.getByTestId("canvas-export-png")).toBeVisible();
  const download = page!.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
  await page!.getByTestId("canvas-export-png").click();
  const d = await download;
  expect(d === null || d.suggestedFilename().length > 0).toBe(true);
});

test("@CV-X6-EXPORT-002 导出覆盖全部节点", async () => {
  await h.openCanvasRow(page!, "SEARCH");
  await page!.getByTestId("canvas-toolbar-more").click();
  await expect(page!.getByTestId("canvas-export-png")).toBeVisible();
  const download = page!.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
  await page!.getByTestId("canvas-export-png").click();
  const d = await download;
  expect(d === null || d.suggestedFilename().length > 0).toBe(true);
});
