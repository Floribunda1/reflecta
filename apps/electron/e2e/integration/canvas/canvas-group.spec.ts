import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import {
  edgesInGraph,
  nodeInGraph,
  openSeededCanvas,
  boxSelect,
  nodeBoxes,
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
