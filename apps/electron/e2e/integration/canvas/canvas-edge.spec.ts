import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { canvasRow } from "../../acceptance/spec/canvas/canvas-e2e";
import {
  nodeInGraph,
  openSeededCanvas,
  edgesInGraph,
  selectEdge,
  leaveCanvasWorkspace,
} from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const TWO = {
  id: "canvas",
  title: "CANVAS",
  elements: [
    { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 150, width: 120, height: 80 },
    { id: "b", kind: "text", props: { text: "B" }, x: 420, y: 150, width: 120, height: 80 },
  ],
  edges: [],
} as const;

async function connectAtoB(page: import("@playwright/test").Page) {
  const sa = (await nodeInGraph(page, "a").boundingBox())!;
  const tb = (await nodeInGraph(page, "b").boundingBox())!;
  await page.mouse.move(sa.x + sa.width, sa.y + sa.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x, tb.y + tb.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

test.describe("连线", () => {
  test("从出桩拖到入桩建立有向边", async () => {
    seedCanvas(TWO);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await expect(edgesInGraph(page)).toHaveCount(0);
      await connectAtoB(page);
      await expect(edgesInGraph(page)).toHaveCount(1);
    } finally {
      await app.close();
    }
  });

  test("同源同目标可建平行边", async () => {
    seedCanvas(TWO);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await connectAtoB(page);
      await connectAtoB(page);
      await expect(edgesInGraph(page)).toHaveCount(2);
    } finally {
      await app.close();
    }
  });

  test("自环 source === target", async () => {
    seedCanvas(TWO);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const sa = (await nodeInGraph(page, "a").boundingBox())!;
      await page.mouse.move(sa.x + sa.width, sa.y + sa.height / 2);
      await page.mouse.down();
      await page.mouse.move(sa.x + sa.width, sa.y + sa.height / 2 + 60, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      await expect(edgesInGraph(page)).toHaveCount(1);
    } finally {
      await app.close();
    }
  });

  test("选中边显示工具栏，改标签提交后重进保留", async () => {
    seedCanvas({
      ...TWO,
      edges: [{ id: "e1", sourceElementId: "a", targetElementId: "b" }],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await selectEdge(page);
      const toolbar = page.getByTestId("canvas-edge-toolbar");
      await expect(toolbar).toBeVisible({ timeout: 5000 });
      const label = toolbar.getByTestId("canvas-edge-label");
      await label.click();
      await page.keyboard.type("causal");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);

      await leaveCanvasWorkspace(page);
      await canvasRow(page, "CANVAS").click();
      await expect(page.getByTestId("canvas-workspace")).toBeVisible();
      await page.waitForTimeout(600);
      await selectEdge(page);
      await expect(page.getByTestId("canvas-graph").locator(".x6-edge").first()).toBeVisible();
      await expect(page.getByTestId("canvas-edge-label").first()).toHaveText("causal", {
        timeout: 8000,
      });
    } finally {
      await app.close();
    }
  });

  test("从边工具栏删除选中边", async () => {
    seedCanvas({
      ...TWO,
      edges: [{ id: "e1", sourceElementId: "a", targetElementId: "b" }],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await expect(edgesInGraph(page)).toHaveCount(1);
      await selectEdge(page);
      await expect(page.getByTestId("canvas-edge-toolbar")).toBeVisible({ timeout: 5000 });
      await page.getByTestId("canvas-edge-toolbar").getByLabel("删除连线").click();
      await page.waitForTimeout(300);
      await expect(edgesInGraph(page)).toHaveCount(0);
    } finally {
      await app.close();
    }
  });
});
