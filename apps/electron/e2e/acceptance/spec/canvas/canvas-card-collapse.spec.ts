import { expect, test, type Locator } from "@playwright/test";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedCanvas,
  seedUnderstanding,
  seedUnderstandingIdByTitle,
  toolPart,
  userMessage,
} from "../agent/agent-fixtures";
import { launchApp, openThread } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * 理解卡折叠：单卡独立展开／收起、按入口与画布记忆、折叠后节点变矮并避让邻居。
 * 编辑画布入口走画布工作区；canvas_present 入口走对话内只读画布。
 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

const LONG_TITLE = "这是一个很长的理解标题：折叠之后必须完整显示，允许换行但绝不能被省略号截断";
const LONG_BODY = "折叠后应该隐藏的正文内容：分区灌溉窗口与回水温度的联动观察。";
const BELOW_BODY = "被压住的下方卡片正文：夜班观察窗口与传感器漂移复核。";

const card = (id: string): Locator => h.nodeInGraph(page, id);
const collapseButton = (id: string): Locator =>
  card(id).getByTestId("canvas-understanding-collapse");
const title = (id: string): Locator => card(id).getByTestId("canvas-understanding-title");

/** 标题是否被省略号截断（单行省略 × 换行不完整）：横向溢出即说明没换行、被裁掉了。 */
const titleTruncated = (id: string) =>
  title(id).evaluate((el) => el.scrollWidth > el.clientWidth + 1);

/** 边路径中点屏幕 y（端点位置变化的观测量）。 */
async function edgeMidpointY(): Promise<number> {
  const mid = await h
    .edgesInGraph(page)
    .first()
    .evaluate((el) => {
      const paths = [...el.querySelectorAll("path")].filter((p) => p.getTotalLength?.() > 10);
      const line = paths
        .map((p) => ({ p, w: parseFloat(p.getAttribute("stroke-width") ?? "0") }))
        .sort((l, r) => r.w - l.w)[0]?.p;
      if (!line) return null;
      const point = line.getPointAtLength(line.getTotalLength() / 2) as DOMPoint;
      return { x: point.x, y: point.y };
    });
  if (!mid) throw new Error("边路径未渲染");
  return mid.y;
}

test.beforeAll(async () => {
  resetAgentFixtures();
  seedUnderstanding({ id: "th_collapse_long", title: LONG_TITLE, body: LONG_BODY });
  const below = seedUnderstandingIdByTitle("React Suspense");

  // A：展开态互不重叠（折叠只影响自己，展开做端点跟随）
  seedCanvas({
    id: "cvx-collapse-a",
    title: "COLLAPSE_A",
    elements: [
      {
        id: "ca_top",
        kind: "understanding",
        understandingId: "th_collapse_long",
        props: {},
        x: 60,
        y: 40,
        width: 340,
        height: 480,
      },
      {
        id: "ca_below",
        kind: "understanding",
        understandingId: below,
        props: {},
        x: 60,
        y: 560,
        width: 340,
        height: 200,
      },
    ],
    edges: [
      {
        id: "ca_edge",
        source: { cell: "ca_top", port: "bottom" },
        target: { cell: "ca_below", port: "top" },
        router: { name: "reflecta-curve" },
        connector: { name: "reflecta-curve" },
        label: "验证",
      },
    ],
    viewport: null,
  });

  // B：另一张画布的同一条理解卡（隔离用）
  seedCanvas({
    id: "cvx-collapse-b",
    title: "COLLAPSE_B",
    elements: [
      {
        id: "cb_card",
        kind: "understanding",
        understandingId: "th_collapse_long",
        props: {},
        x: 60,
        y: 40,
        width: 340,
        height: 480,
      },
    ],
    edges: [],
    viewport: null,
  });

  // C：保存下来的几何本来贴着下方卡片（用户折叠后把邻居挪近），展开时必须避让
  seedCanvas({
    id: "cvx-collapse-c",
    title: "COLLAPSE_C",
    elements: [
      {
        id: "cc_top",
        kind: "understanding",
        understandingId: "th_collapse_long",
        props: {},
        x: 60,
        y: 40,
        width: 340,
        height: 480,
      },
      {
        id: "cc_below",
        kind: "understanding",
        understandingId: below,
        props: {},
        x: 60,
        y: 120,
        width: 340,
        height: 200,
      },
    ],
    edges: [
      {
        id: "cc_edge",
        source: { cell: "cc_top", port: "right" },
        target: { cell: "cc_below", port: "right" },
        router: { name: "reflecta-curve" },
        connector: { name: "reflecta-curve" },
        label: null,
      },
    ],
    viewport: null,
  });

  // canvas_present：对话内只读画布，两张理解卡
  seedAgentThread({
    id: "thread-collapse",
    title: "折叠展示",
    messages: [
      userMessage("thread-collapse-u", "帮我分析一下"),
      assistantMessage("thread-collapse-a", [
        toolPart("canvas_present", "thread-collapse-tool", {
          kind: "canvas-view",
          version: 1,
          title: "分析画布",
          document: {
            elements: [
              {
                id: "pv_top",
                kind: "understanding",
                understandingId: "th_collapse_long",
                props: {},
                x: 40,
                y: 40,
                width: 340,
                height: 260,
              },
              {
                id: "pv_below",
                kind: "understanding",
                understandingId: below,
                props: {},
                x: 40,
                y: 340,
                width: 340,
                height: 200,
              },
            ],
            edges: [],
          },
        }),
      ]),
    ],
  });

  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
});

test.afterEach(async () => {
  // 让防抖持久化落库（800ms）+ 折叠记忆写盘，避免下一场景读到旧状态
  if (page) await page.waitForTimeout(1400);
});

test.afterAll(async () => {
  await app?.close();
});

test("@CV-CARD-022 折叠理解卡只保留完整标题与展开按钮且不影响其他卡片", async () => {
  await h.openCanvasRow(page, "COLLAPSE_A");
  await expect(card("ca_top")).toHaveAttribute("data-collapsed", "false");
  await expect(card("ca_top")).toContainText(LONG_BODY);
  // 展开态标题单行省略 → 换行才是「完整显示」
  expect(await titleTruncated("ca_top")).toBe(true);
  const expanded = (await h.nodeGeometry(page, "ca_top"))!;
  const belowBefore = (await h.nodeGeometry(page, "ca_below"))!;
  const edgeBefore = await edgeMidpointY();

  await collapseButton("ca_top").click();
  await expect(card("ca_top")).toHaveAttribute("data-collapsed", "true");
  await expect(card("ca_top")).not.toContainText(LONG_BODY);
  // 长标题完整：换行显示，不横向溢出
  expect(await titleTruncated("ca_top")).toBe(false);
  // 节点实际高度缩小，连线端点跟随（边变短 → 中点上升）
  const collapsed = (await h.nodeGeometry(page, "ca_top"))!;
  expect(collapsed.height).toBeLessThan(expanded.height / 2);
  expect(await edgeMidpointY()).toBeLessThan(edgeBefore - 10);
  // 单卡操作互不影响
  expect(await h.nodeGeometry(page, "ca_below")).toEqual(belowBefore);
  await expect(card("ca_below")).toHaveAttribute("data-collapsed", "false");

  await collapseButton("ca_top").click();
  await expect(card("ca_top")).toHaveAttribute("data-collapsed", "false");
  await expect(card("ca_top")).toContainText(LONG_BODY);
  expect((await h.nodeGeometry(page, "ca_top"))!.height).toBeCloseTo(expanded.height, 0);
});

test("@CV-CARD-023 折叠状态重进画布后恢复且不同画布互不影响", async () => {
  await h.openCanvasRow(page, "COLLAPSE_A");
  await collapseButton("ca_top").click();
  await expect(card("ca_top")).toHaveAttribute("data-collapsed", "true");

  // 切走再回来（重新进入画布）
  await h.openCanvasRow(page, "COLLAPSE_B");
  await expect(card("cb_card")).toHaveAttribute("data-collapsed", "false");
  await h.openCanvasRow(page, "COLLAPSE_A");
  await expect(card("ca_top")).toHaveAttribute("data-collapsed", "true");

  // 刷新 renderer 后仍然恢复
  await page.reload();
  await h.openCanvasRow(page, "COLLAPSE_A");
  await expect(card("ca_top")).toHaveAttribute("data-collapsed", "true");
  // 另一张画布的同一条理解卡不受影响（按画布 + 卡片隔离）
  await h.openCanvasRow(page, "COLLAPSE_B");
  await expect(card("cb_card")).toHaveAttribute("data-collapsed", "false");
});

test("@CV-CARD-024 展开理解卡时相邻卡片自动避让且连线跟随", async () => {
  await h.openCanvasRow(page, "COLLAPSE_C");
  const top = (await h.nodeGeometry(page, "cc_top"))!;
  const below = (await h.nodeGeometry(page, "cc_below"))!;
  // 保存下来的几何：展开态下两张卡片叠在一起
  expect(below.y).toBeLessThan(top.y + top.height);
  const portBefore = (await h.portCenter(page, "cc_below", "top"))!;

  await collapseButton("cc_top").click();
  const collapsedTop = (await h.nodeGeometry(page, "cc_top"))!;
  const untouched = (await h.nodeGeometry(page, "cc_below"))!;
  expect(collapsedTop.y + collapsedTop.height).toBeLessThanOrEqual(untouched.y);
  // 折叠不会推动任何邻居
  expect(untouched).toEqual(below);

  await collapseButton("cc_top").click();
  const expandedTop = (await h.nodeGeometry(page, "cc_top"))!;
  const pushed = (await h.nodeGeometry(page, "cc_below"))!;
  expect(expandedTop.y + expandedTop.height).toBeLessThanOrEqual(pushed.y);
  expect(pushed.y).toBeGreaterThan(below.y);
  // 连线端点跟随节点实际位置：下推后端口随之向下
  const portAfter = (await h.portCenter(page, "cc_below", "top"))!;
  expect(portAfter.y).toBeGreaterThan(portBefore.y + 10);
  // 连线仍连接原来两端
  expect(await h.edgeTerminals(page, "cc_edge")).toEqual({
    source: "cc_top",
    target: "cc_below",
  });

  // 原有拖拽 / 缩放仍正常
  const viewportBefore = await h.graphViewport(page);
  const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
  await page.mouse.move(graphBox.x + graphBox.width / 2, graphBox.y + graphBox.height / 2);
  await page.keyboard.down("Meta");
  await page.mouse.wheel(0, -240);
  await page.keyboard.up("Meta");
  await page.waitForTimeout(250);
  const viewportAfter = await h.graphViewport(page);
  expect(viewportAfter!.zoom).toBeGreaterThan(viewportBefore!.zoom);

  const pushedBeforeDrag = (await h.nodeGeometry(page, "cc_below"))!;
  await h.dragNodeBy(page, "cc_below", 0, -30);
  expect((await h.nodeGeometry(page, "cc_below"))!.y).toBeLessThan(pushedBeforeDrag.y);
});

test("@CV-RO-004 canvas_present 首次展示默认折叠且单张展开互不影响", async () => {
  // 前三个场景停留在画布模块：直接切到对话模块（openAgentPage 会等首屏 capture-page）
  await page.getByTestId("app-nav-module-agent").click();
  await expect(page.getByTestId("agent-page")).toBeVisible();
  await openThread(page, "折叠展示");
  const view = page.getByTestId("agent-canvas-view");
  await expect(view).toBeVisible();
  const top = view.locator('[data-node-id="pv_top"]');
  const below = view.locator('[data-node-id="pv_below"]');
  await expect(top).toHaveAttribute("data-collapsed", "true");
  await expect(below).toHaveAttribute("data-collapsed", "true");
  await expect(top).not.toContainText(LONG_BODY);
  await expect(below).not.toContainText(BELOW_BODY);

  await top.getByTestId("canvas-understanding-collapse").click();
  await expect(top).toHaveAttribute("data-collapsed", "false");
  await expect(top).toContainText(LONG_BODY);
  // 只影响被点击的这一张
  await expect(below).toHaveAttribute("data-collapsed", "true");
  await expect(below).not.toContainText(BELOW_BODY);
});
