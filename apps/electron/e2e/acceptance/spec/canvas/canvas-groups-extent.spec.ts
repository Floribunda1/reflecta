import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * @CV-CARD-020 组内成员移动受组边界约束 + @CV-PERSIST-005 组背景层级持久化。
 * 独立文件：组链（server 级联删除）会让共享画布状态不可复现，这里用独立画布 + 独立 app。
 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-grp7",
    title: "GRP7",
    elements: [
      { id: "g7a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
      { id: "g7b", kind: "text", props: { text: "B" }, x: 320, y: 160, width: 120, height: 80 },
    ],
    edges: [],
    viewport: null,
  });
  // PERSIST-005：预置组结构（group 含成员），校验重载后组背景层级（zIndex=-1）保持一致
  seedCanvas({
    id: "cvx-grpz",
    title: "GRPZ",
    elements: [
      {
        id: "gza",
        kind: "text",
        props: { text: "A" },
        x: 100,
        y: 100,
        width: 120,
        height: 80,
        parentId: "grpz",
      },
      {
        id: "gzb",
        kind: "text",
        props: { text: "B" },
        x: 320,
        y: 160,
        width: 120,
        height: 80,
        parentId: "grpz",
      },
      {
        id: "grpz",
        kind: "group",
        props: { label: "ZGRP" },
        x: 80,
        y: 80,
        width: 400,
        height: 220,
        zIndex: -1,
      },
    ],
    edges: [],
    viewport: null,
  });
  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
});
test.afterAll(async () => {
  await app?.close();
});

test("@CV-CARD-020 组内成员移动受组边界约束", async () => {
  await h.openCanvasRow(page!, "GRP7");
  // 自建前置：打组 g7a/g7b（框选可能落空，重试直到选区工具条出现）
  await expect
    .poll(
      async () => {
        const gb = await h.nodeBoxes(page!, ["g7a", "g7b"]);
        await h.boxSelect(page!, gb);
        return page!
          .getByTestId("canvas-selection-group-button")
          .isVisible()
          .catch(() => false);
      },
      { timeout: 15000 },
    )
    .toBe(true);
  await page!.getByTestId("canvas-selection-group-button").click();
  let tree: Awaited<ReturnType<typeof h.groupTree>> = [];
  await expect
    .poll(
      async () => {
        tree = await h.groupTree(page!);
        return tree[0] ?? null;
      },
      { timeout: 5000 },
    )
    .toBeDefined();
  const inner = tree[0]!;
  await h.dragNodeBy(page!, "g7a", 900, 500);
  const pos = await h.nodeGeometry(page!, "g7a");
  const bbox = await page!.evaluate((id) => {
    const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
    const n = g?.getCellById(id);
    if (!n?.isNode()) return null;
    const b = n.getBBox();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }, inner.id);
  expect(pos!.x).toBeGreaterThanOrEqual(bbox!.x - 1);
  expect(pos!.x + pos!.width).toBeLessThanOrEqual(bbox!.x + bbox!.width + 1);
  expect(pos!.y).toBeGreaterThanOrEqual(bbox!.y - 1);
  expect(pos!.y + pos!.height).toBeLessThanOrEqual(bbox!.y + bbox!.height + 1);
});

test("@CV-PERSIST-005 组背景渲染层级重载一致", async () => {
  await h.openCanvasRow(page!, "GRPZ");
  const zIndex = () =>
    page!.evaluate((id) => {
      const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
      const node = g?.getCellById(id);
      return node?.isNode() ? node.getZIndex() : null;
    }, "grpz");
  await expect.poll(zIndex, { timeout: 8000 }).toBe(-1);
  await h.openCanvasRow(page!, "GRPZ");
  await expect.poll(zIndex, { timeout: 8000 }).toBe(-1);
});
