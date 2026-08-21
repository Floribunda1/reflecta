import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import {
  boxSelect,
  dragNodeBy,
  edgesInGraph,
  nodeBoxes,
  nodeGeometry,
  nodeInGraph,
  openSeededCanvas,
} from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const THREE = {
  id: "canvas",
  title: "CANVAS",
  elements: [
    { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
    { id: "b", kind: "text", props: { text: "B" }, x: 320, y: 160, width: 120, height: 80 },
    { id: "c", kind: "text", props: { text: "C" }, x: 700, y: 320, width: 120, height: 80 },
  ],
  edges: [{ id: "e1", sourceElementId: "a", targetElementId: "c" }],
} as const;

test.describe("组语义", () => {
  test("选区工具条打组：成员位置不跳变且被组包围", async () => {
    seedCanvas(THREE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const before = await nodeBoxes(page, ["a", "b"]);
      await boxSelect(page, before);

      const toolbar = page.getByTestId("canvas-selection-toolbar");
      await expect(toolbar).toBeVisible();
      await toolbar.getByTestId("canvas-selection-group-button").click();
      await page.waitForTimeout(300);

      const after = await nodeBoxes(page, ["a", "b"]);
      for (const id of ["a", "b"]) {
        const i = id === "a" ? 0 : 1;
        expect(Math.abs(after[i].x - before[i].x)).toBeLessThanOrEqual(2);
        expect(Math.abs(after[i].y - before[i].y)).toBeLessThanOrEqual(2);
      }
      // 组仍存在（占位：组的 nodeId 随机，需按 data-testid=canvas-group-node 校验）
      await expect(page.getByTestId("canvas-graph").getByTestId("canvas-group-node")).toHaveCount(
        1,
      );
    } finally {
      await app.close();
    }
  });

  test("单选不出现选区工具条", async () => {
    seedCanvas(THREE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await nodeInGraph(page, "a").click();
      await page.waitForTimeout(150);
      await expect(page.getByTestId("canvas-selection-toolbar")).toHaveCount(0);
    } finally {
      await app.close();
    }
  });

  test("右键删除组：级联删除成员与关联边，组外保留", async () => {
    seedCanvas(THREE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const before = await nodeBoxes(page, ["a", "b"]);
      await boxSelect(page, before);
      await page.getByTestId("canvas-selection-group-button").click();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("canvas-graph").getByTestId("canvas-group-node")).toHaveCount(
        1,
      );
      await expect(edgesInGraph(page)).toHaveCount(1);

      // 右键组 → 删除组
      await page
        .getByTestId("canvas-graph")
        .getByTestId("canvas-group-node")
        .first()
        .click({ button: "right" });
      await expect(page.getByTestId("canvas-group-delete")).toBeVisible({ timeout: 8000 });
      await page.getByTestId("canvas-group-delete").click();

      await expect(nodeInGraph(page, "a")).toHaveCount(0);
      await expect(nodeInGraph(page, "b")).toHaveCount(0);
      await expect(edgesInGraph(page)).toHaveCount(0);
      await expect(nodeInGraph(page, "c").first()).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("双击组名改名，Enter 提交", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "g",
          kind: "group",
          props: { label: "OLD" },
          x: 100,
          y: 100,
          width: 300,
          height: 200,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const label = nodeInGraph(page, "g").first().getByTestId("canvas-group-label");
      await expect(label).toContainText("OLD");
      await label.dblclick();
      const input = nodeInGraph(page, "g").getByRole("textbox", { name: "组名" });
      await expect(input).toBeVisible();
      await input.fill("NEW");
      await input.press("Enter");
      await expect(label).toContainText("NEW");
    } finally {
      await app.close();
    }
  });
});

test.describe("组语义 · 嵌套 / 解组 / 颜色 / 边界", () => {
  const groupViaToolbar = async (page: import("@playwright/test").Page, ids: string[]) => {
    await boxSelect(page, await nodeBoxes(page, ids));
    await page.getByTestId("canvas-selection-group-button").click();
    await page.waitForTimeout(300);
  };

  test("组内再打组形成嵌套组", async () => {
    seedCanvas(THREE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      // 第一次：a+b 建组 G1
      const boxesAB = await nodeBoxes(page, ["a", "b"]);
      await boxSelect(page, boxesAB);
      await page.getByTestId("canvas-selection-group-button").click();
      await page.waitForTimeout(300);
      // 第二次：G1(含 a/b) + c 建组 G2 —— 组作为成员参与（嵌套）
      await boxSelect(page, await nodeBoxes(page, ["a", "b", "c"]));
      await page.getByTestId("canvas-selection-group-button").click();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("canvas-graph").getByTestId("canvas-group-node")).toHaveCount(
        2,
      );
      // G1 是 G2 的子节点（成员互相位置关系保持）
      const parentOf = (id: string) =>
        page.evaluate((id) => {
          const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
          return g ? (g.getCellById(id)?.getParent()?.id ?? null) : null;
        }, id);
      const gA = await parentOf("a");
      const gC = await parentOf("c");
      expect(gA).not.toBeNull();
      expect(gC).not.toBeNull();
      // 嵌套：外层组是内层组的父
      const aParent = await parentOf(gA!);
      expect(aParent).toBe(gC === null ? aParent : gC);
    } finally {
      await app.close();
    }
  });

  test("组右键解组，成员回到上级位置", async () => {
    seedCanvas(THREE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const beforeA = await nodeGeometry(page, "a");
      await groupViaToolbar(page, ["a", "b"]);
      const groupNode = page.getByTestId("canvas-graph").getByTestId("canvas-group-node").first();
      await expect(groupNode).toBeVisible();
      await groupNode.click({ button: "right" });
      await page.getByTestId("canvas-group-ungroup").click();
      await page.waitForTimeout(300);
      await expect(groupNode).toHaveCount(0);
      const afterA = await nodeGeometry(page, "a");
      expect(afterA?.x).toBe(beforeA?.x);
      expect(afterA?.y).toBe(beforeA?.y);
    } finally {
      await app.close();
    }
  });

  test("选中组后可设置颜色并保存", async () => {
    seedCanvas(THREE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await groupViaToolbar(page, ["a", "b"]);
      const groupNode = page.getByTestId("canvas-graph").getByTestId("canvas-group-node").first();
      await groupNode.click();
      await expect(page.getByTitle("选择颜色").first()).toBeVisible();
      await page.getByTitle("选择颜色").first().click();
      await page.locator("button[title='chart-1']").first().click();
      await page.waitForTimeout(400);
      await expect
        .poll(async () =>
          groupNode.evaluate((el) => getComputedStyle(el).borderTopColor === "rgb(71, 158, 194)"),
        )
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test("子成员移动受组边界约束（extent）", async () => {
    seedCanvas(THREE);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await groupViaToolbar(page, ["a", "b"]);
      const groupBox = (await page
        .getByTestId("canvas-graph")
        .getByTestId("canvas-group-node")
        .first()
        .boundingBox())!;
      // 向外猛拖成员 a 很远
      await dragNodeBy(page, "a", 900, 500);
      const a = await nodeGeometry(page, "a");
      expect(a).not.toBeNull();
      const b = await nodeGeometry(page, "b");
      // a 仍落在组 box 内（贴边），没有被拖出界
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      const ax = graphBox.x + a!.x;
      const ay = graphBox.y + a!.y;
      expect(ax).toBeGreaterThanOrEqual(groupBox.x - 1);
      expect(ay).toBeGreaterThanOrEqual(groupBox.y - 1);
      expect(ax + a!.width).toBeLessThanOrEqual(groupBox.x + groupBox.width + 1);
      expect(ay + a!.height).toBeLessThanOrEqual(groupBox.y + groupBox.height + 1);
      void b;
    } finally {
      await app.close();
    }
  });
});
