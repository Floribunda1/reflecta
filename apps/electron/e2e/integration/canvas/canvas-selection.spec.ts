import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import {
  nodeInGraph,
  openSeededCanvas,
  boxSelect,
  nodeBoxes,
  selectEdge,
} from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const TWO = {
  id: "canvas",
  title: "CANVAS",
  elements: [
    { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
    { id: "b", kind: "text", props: { text: "B" }, x: 320, y: 160, width: 120, height: 80 },
  ],
  edges: [{ id: "e1", sourceElementId: "a", targetElementId: "b" }],
} as const;

test.describe("选择与选区", () => {
  test("单击选中单个节点", async () => {
    seedCanvas(TWO);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await nodeInGraph(page, "a").first().click();
      await page.waitForTimeout(250);
      await expect(page.getByTestId("canvas-selection-toolbar")).toHaveCount(0);
      // 单选有选中态（精确 ring-ring token，非 focus 样式）
      await expect
        .poll(async () =>
          nodeInGraph(page, "a")
            .first()
            .evaluate((el) => el.classList.contains("ring-ring")),
        )
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test("框选两个节点后出现选区工具条", async () => {
    seedCanvas(TWO);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await boxSelect(page, await nodeBoxes(page, ["a", "b"]));
      await expect(page.getByTestId("canvas-selection-toolbar")).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("选中边出现底部边工具栏", async () => {
    seedCanvas(TWO);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await selectEdge(page);
      await expect(page.getByTestId("canvas-edge-toolbar")).toBeVisible({ timeout: 5000 });
    } finally {
      await app.close();
    }
  });
});
