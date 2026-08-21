import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * 组语义 + 组级持久化 + 打组撤销。串行单 app，每个场景先从 DB 重新进入画布。
 * 注意：extent（GRP-007）的拖拽会留下一次残文档保存（产品问题，另有跟进），
 * 所以放在文件末尾，避免污染后续依赖干净父子状态的场景。
 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

const groupNodes = () => page!.getByTestId("canvas-graph").first().getByTestId("canvas-group-node");

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-group",
    title: "GROUP",
    elements: [
      { id: "g_a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
      { id: "g_b", kind: "text", props: { text: "B" }, x: 320, y: 160, width: 120, height: 80 },
      { id: "g_c", kind: "text", props: { text: "C" }, x: 700, y: 320, width: 120, height: 80 },
      {
        id: "g_d",
        kind: "text",
        props: { text: "SNK_TEXT" },
        x: 900,
        y: 500,
        width: 120,
        height: 80,
      },
    ],
    edges: [{ id: "e1", sourceElementId: "g_a", targetElementId: "g_c" }],
    viewport: null,
  });
  seedCanvas({
    id: "cvx-aux2",
    title: "AUX2",
    elements: [
      { id: "ax_a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
      { id: "ax_b", kind: "text", props: { text: "B" }, x: 320, y: 160, width: 120, height: 80 },
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

test("@CV-X6-GRP-001 打组：位置不跳变且组包围成员", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const before = await h.nodeGeometry(page!, "g_a");
  const gb = await h.nodeBoxes(page!, ["g_a", "g_b"]);
  await h.boxSelect(page!, gb);
  await page!.getByTestId("canvas-selection-group-button").click();
  await page!.waitForTimeout(300);
  await expect(groupNodes()).toHaveCount(1);
  const after = await h.nodeGeometry(page!, "g_a");
  expect(after!.x).toBe(before!.x);
  expect(after!.y).toBe(before!.y);
  const tree = await h.groupTree(page!);
  expect(tree[0]?.children).toEqual(expect.arrayContaining(["g_a", "g_b"]));
});

test("@CV-X6-GRP-002 组内再打组形成嵌套组", async () => {
  await h.openCanvasRow(page!, "GROUP");
  // 真实用户多选：点击内层组卡，再 ⌘/Ctrl+点击 c → [组, c] → 打组
  const tree = await h.groupTree(page!); // 等内层组渲染完成
  const inner = tree.find((g) => g.children.includes("g_a"));
  expect(inner).toBeDefined();
  await h.clickNode(page!, inner!.id);
  await page!.waitForTimeout(200);
  const cBox = (await h.nodeInGraph(page!, "g_c").first().boundingBox())!;
  await page!.keyboard.down("Meta");
  await page!.mouse.click(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
  await page!.keyboard.up("Meta");
  await page!.waitForTimeout(250);
  await expect(page!.getByTestId("canvas-selection-group-button")).toBeVisible();
  await page!.getByTestId("canvas-selection-group-button").click();
  await page!.waitForTimeout(400);
  await expect(groupNodes()).toHaveCount(2);
});

test("@CV-X6-GRP-003 右键解组：成员回到上级位置", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const tree = await h.groupTree(page!);
  const inner = tree.find((g) => g.children.includes("g_a"))!;
  const outer = tree.find((g) => g.children.includes(inner.id))!;
  await h.nodeInGraph(page!, outer.id).first().click({ button: "right" });
  await page!.getByTestId("canvas-group-ungroup").click();
  await page!.waitForTimeout(300);
  const after = await h.groupTree(page!);
  expect(after.find((g) => g.id === outer.id)).toBeUndefined();
  const cParent = await page!.evaluate((id) => {
    const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    return g?.getCellById(id)?.getParent()?.id ?? null;
  }, "g_c");
  expect(cParent).toBeNull();
  const aParent = await page!.evaluate((id) => {
    const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    return g?.getCellById(id)?.getParent()?.id ?? null;
  }, "g_a");
  expect(aParent).toBe(inner.id);
});

test("@CV-X6-GRP-005 双击组名改名 Enter 提交并重进保留", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const tree = await h.groupTree(page!);
  const inner = tree.find((g) => g.children.includes("g_a"))!;
  const groupNode = h.nodeInGraph(page!, inner.id).first();
  await expect(groupNode).toBeVisible();
  await groupNode.locator('[data-testid="canvas-group-label"]').click({ clickCount: 2 });
  const input = page!.getByLabel("组名");
  await expect(input).toBeVisible();
  await input.fill("SNK_GROUP2");
  await page!.keyboard.press("Enter");
  await expect(groupNode).toHaveAttribute("data-group-label", "SNK_GROUP2");
  await h.openCanvasRow(page!, "GROUP");
  await expect(h.nodeInGraph(page!, inner.id).first()).toHaveAttribute(
    "data-group-label",
    "SNK_GROUP2",
  );
});

test("@CV-X6-GRP-006 为组设置颜色", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const tree = await h.groupTree(page!);
  const inner = tree.find((g) => g.children.includes("g_a"))!;
  const groupNode = h.nodeInGraph(page!, inner.id).first();
  await groupNode.click();
  await page!.waitForTimeout(250);
  await page!.getByTitle("选择颜色").first().click();
  await page!.locator("button[title='chart-2']").first().click();
  await page!.waitForTimeout(400);
  const color = await page!.evaluate((id) => {
    const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    return (g?.getCellById(id)?.getData() as { element?: { props?: { color?: string } } })?.element
      ?.props?.color;
  }, inner.id);
  expect(color).toBe("chart-2");
});

test("@CV-X6-PERSIST-004 打组后保存重进仍是组结构", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const tree = await h.groupTree(page!);
  const inner = tree.find((g) => g.children.includes("g_a"))!;
  await h.openCanvasRow(page!, "GROUP");
  const afterTree = await h.groupTree(page!);
  const afterInner = afterTree.find((g) => g.children.includes("g_a"));
  expect(afterInner?.id).toBe(inner.id);
  expect(afterInner!.children).toEqual(expect.arrayContaining(["g_a", "g_b"]));
});

test("@CV-X6-PERSIST-002 组的层级与相对坐标重载一致", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const tree = await h.groupTree(page!);
  const inner = tree.find((g) => g.children.includes("g_a"))!;
  const relA = await h.nodeGeometry(page!, "g_a");
  const frame = { parent: inner.id, x: relA!.x, y: relA!.y, w: relA!.width, h: relA!.height };
  await h.openCanvasRow(page!, "GROUP");
  await expect
    .poll(async () => {
      return await page!.evaluate((frameW) => {
        const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
        const a = g?.getCellById("g_a");
        const p = a?.getParent()?.id ?? null;
        const pos = a?.isNode() ? a.position() : null;
        const size = a?.isNode() ? a.size() : null;
        if (p !== frameW.parent) return null;
        return { x: pos.x, y: pos.y, w: size.width, h: size.height };
      }, frame);
    })
    .toEqual({ x: frame.x, y: frame.y, w: frame.w, h: frame.h });
});

test("@CV-X6-GRP-004 右键删除组并级联清理成员与连线", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const tree = await h.groupTree(page!);
  const inner = tree.find((g) => g.children.includes("g_a"))!;
  await h.nodeInGraph(page!, inner.id).first().click({ button: "right" });
  await page!.getByTestId("canvas-group-delete").click();
  await page!.waitForTimeout(300);
  await expect(h.nodeInGraph(page!, "g_a")).toHaveCount(0);
  await expect(h.nodeInGraph(page!, "g_b")).toHaveCount(0);
  await expect(h.edgesInGraph(page!)).toHaveCount(0);
  await expect(h.nodeInGraph(page!, "g_d").first()).toBeVisible();
});

test("@CV-X6-AUX-002 撤销并重做打组 / 解组", async () => {
  await h.openCanvasRow(page!, "GROUP");
  const gb = await h.nodeBoxes(page!, ["g_c", "g_d"]);
  await h.boxSelect(page!, gb);
  await page!.getByTestId("canvas-selection-group-button").click();
  await page!.waitForTimeout(300);
  await expect(groupNodes()).toHaveCount(1);
  await page!.keyboard.press("Meta+z");
  await expect(groupNodes()).toHaveCount(0);
  await page!.keyboard.press("Meta+Shift+z");
  await expect(groupNodes()).toHaveCount(1);
});
