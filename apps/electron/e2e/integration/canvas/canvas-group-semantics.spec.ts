import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { boxSelectNodes, edgesInGraph, nodeInGraph, openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
});

const THREE_CARDS = {
  id: "canvas",
  title: "CANVAS",
  elements: [
    { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
    { id: "b", kind: "text", props: { text: "B" }, x: 320, y: 160, width: 120, height: 80 },
    { id: "c", kind: "text", props: { text: "C" }, x: 700, y: 320, width: 120, height: 80 },
  ],
  edges: [{ id: "e1", sourceElementId: "a", targetElementId: "c" }],
} as const;

async function nodeBoxes(page: import("@playwright/test").Page, ids: string[]) {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (const id of ids) {
    boxes.push((await nodeInGraph(page, id).boundingBox())!);
  }
  return boxes;
}

/**
 * 自建组语义（graph-operations.ts + workspace 快捷键）：
 * - 打组（Cmd/Ctrl+G）：成员画布位置不跳变、组包围成员——这是自建行为，RF 只提供 parentId 原语；
 * - 解组（Cmd/Ctrl+Shift+G）：成员回原位；
 * - 删除组（右键 → 删除组）：级联删除成员与关联连线（M3-D5，CV-EL-006 无 acceptance 实现）。
 * RF 内置的 parent/child 渲染、extent 约束引擎行为不在此覆盖（regression 已有 expandParent 约束测试）。
 */
test.describe("画布组语义", () => {
  test("打组后成员位置不跳变且被组包围", async () => {
    seedCanvas(THREE_CARDS);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const before = await nodeBoxes(page, ["a", "b"]);

      await boxSelectNodes(page, before);
      await page.keyboard.press("Meta+g");
      await page.waitForTimeout(300);

      const group = page.getByTestId("canvas-graph").locator(".react-flow__node-group");
      await expect(group).toHaveCount(1);

      const after = await nodeBoxes(page, ["a", "b"]);
      for (const id of ["a", "b"]) {
        const index = id === "a" ? 0 : 1;
        expect(Math.abs(after[index].x - before[index].x)).toBeLessThanOrEqual(2);
        expect(Math.abs(after[index].y - before[index].y)).toBeLessThanOrEqual(2);
      }

      // 组包围成员：组框含 a、b，且不改变成员可见性
      const groupBox = (await group.boundingBox())!;
      expect(groupBox.x).toBeLessThanOrEqual(Math.min(after[0].x, after[1].x));
      expect(groupBox.y).toBeLessThanOrEqual(Math.min(after[0].y, after[1].y));
      expect(groupBox.x + groupBox.width).toBeGreaterThanOrEqual(
        Math.max(after[0].x + after[0].width, after[1].x + after[1].width),
      );
      expect(groupBox.y + groupBox.height).toBeGreaterThanOrEqual(
        Math.max(after[0].y + after[0].height, after[1].y + after[1].height),
      );
    } finally {
      await app.close();
    }
  });

  test("解组后成员回到打组前位置", async () => {
    seedCanvas(THREE_CARDS);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const before = await nodeBoxes(page, ["a", "b"]);

      await boxSelectNodes(page, before);
      await page.keyboard.press("Meta+g");
      await expect(page.getByTestId("canvas-graph").locator(".react-flow__node-group")).toHaveCount(
        1,
      );

      await page.keyboard.press("Meta+Shift+g");
      await expect(page.getByTestId("canvas-graph").locator(".react-flow__node-group")).toHaveCount(
        0,
      );

      const after = await nodeBoxes(page, ["a", "b"]);
      for (const id of ["a", "b"]) {
        const index = id === "a" ? 0 : 1;
        expect(Math.abs(after[index].x - before[index].x)).toBeLessThanOrEqual(2);
        expect(Math.abs(after[index].y - before[index].y)).toBeLessThanOrEqual(2);
      }
    } finally {
      await app.close();
    }
  });

  test("selection 工具条：多选后顶部出现打组入口，点击生成组且成员不跳位", async () => {
    seedCanvas(THREE_CARDS);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const before = await nodeBoxes(page, ["a", "b"]);

      // 单选不显示工具条
      await nodeInGraph(page, "a").click();
      await expect(page.getByTestId("canvas-selection-toolbar")).toHaveCount(0);

      await boxSelectNodes(page, before);
      const toolbar = page.getByTestId("canvas-selection-toolbar");
      await expect(toolbar).toBeVisible();
      await toolbar.getByTestId("canvas-selection-group-button").click();

      const group = page.getByTestId("canvas-graph").locator(".react-flow__node-group");
      await expect(group).toHaveCount(1);
      const after = await nodeBoxes(page, ["a", "b"]);
      for (const id of ["a", "b"]) {
        const index = id === "a" ? 0 : 1;
        expect(Math.abs(after[index].x - before[index].x)).toBeLessThanOrEqual(2);
        expect(Math.abs(after[index].y - before[index].y)).toBeLessThanOrEqual(2);
      }
    } finally {
      await app.close();
    }
  });

  test("右键删除组：级联删除成员与关联连线，组外元素保留", async () => {
    seedCanvas(THREE_CARDS);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const before = await nodeBoxes(page, ["a", "b"]);

      await boxSelectNodes(page, before);
      await page.keyboard.press("Meta+g");
      const group = page.getByTestId("canvas-graph").locator(".react-flow__node-group");
      await expect(group).toHaveCount(1);
      await expect(edgesInGraph(page)).toHaveCount(1); // a→c 连线在组外挂着

      // 注：选中态下 RF 的 nodesselection 覆盖层会拦截右键；先点空白取消选中再右键组。
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      await page.mouse.click(graphBox.x + 12, graphBox.y + 12);
      await expect(group).not.toHaveClass(/selected/);

      // 右键组 → 删除组（含组内内容）
      await group.getByTestId("canvas-group-node").click({ button: "right" });
      const deleteItem = page.getByTestId("canvas-group-delete");
      await expect(deleteItem).toBeVisible({ timeout: 8000 });
      await deleteItem.click();

      await expect(group).toHaveCount(0);
      await expect(nodeInGraph(page, "a")).toHaveCount(0);
      await expect(nodeInGraph(page, "b")).toHaveCount(0);
      await expect(edgesInGraph(page)).toHaveCount(0); // a→c 随 a 级联删除
      await expect(nodeInGraph(page, "c")).toBeVisible();
    } finally {
      await app.close();
    }
  });
});
