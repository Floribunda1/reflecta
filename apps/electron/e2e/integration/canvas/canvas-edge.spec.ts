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

test.describe("连线样式", () => {
  const edgeStyle = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const g = (window as unknown as { __x6graph?: import("@antv/x6").Graph }).__x6graph;
      if (!g) return null;
      const edge = g.getEdges()[0];
      if (!edge) return null;
      const attrs = edge.getAttrs() as {
        line?: {
          stroke?: string;
          strokeWidth?: number;
          strokeDasharray?: string;
          targetMarker?: unknown;
        };
      };
      return {
        strokeToken: attrs.line?.stroke ?? null,
        strokeWidth: attrs.line?.strokeWidth ?? null,
        dasharray: attrs.line?.strokeDasharray ?? null,
        hasArrow: attrs.line?.targetMarker != null,
        connector: edge.getConnector()?.name ?? null,
      };
    });

  test("选中边后改颜色 / 形状 / 线型 / 线宽 / 箭头（样式即改即生效）", async () => {
    test.setTimeout(60000);
    const doc = {
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 150, width: 120, height: 80 },
        { id: "b", kind: "text", props: { text: "B" }, x: 420, y: 150, width: 120, height: 80 },
      ],
      edges: [{ id: "e1", sourceElementId: "a", targetElementId: "b", style: {} }],
    };
    seedCanvas(doc as never);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await selectEdge(page);
      await expect(page.getByTestId("canvas-edge-toolbar")).toBeVisible();

      // 颜色 → chart-1
      await page.getByTitle("颜色").first().click();
      await page.locator("button[title='chart-1']").first().click();
      await page.waitForTimeout(300);
      // 形状：直线
      await page.getByTitle("形状").first().click();
      await page.getByText("直线", { exact: true }).first().click();
      // 线型：虚线
      await page.getByTitle("线型").first().click();
      await page.getByText("虚线", { exact: true }).first().click();
      // 线宽：粗
      await page.getByTitle("线宽").first().click();
      await page.getByText("粗", { exact: true }).first().click();
      // 箭头：无
      await page.getByTitle("箭头").first().click();
      await page.getByText("无", { exact: true }).first().click();
      await page.waitForTimeout(300);

      const s1 = await edgeStyle(page);
      expect(s1?.strokeToken).toBe("var(--chart-1)");
      expect(s1?.connector).toBe("normal");
      expect(s1?.dasharray).toBe("5 5");
      expect(s1?.strokeWidth).toBe(4);
      expect(s1?.hasArrow).toBe(false);
      // 重进保留（与“标签重进保留”走同一条 updateEdge 持久化管线）
      await leaveCanvasWorkspace(page);
      await openSeededCanvas(page, "CANVAS");
      const s2 = await edgeStyle(page);
      expect(s2?.strokeToken).toBe("var(--chart-1)");
      expect(s2?.connector).toBe("straight");
      expect(s2?.dasharray).toBe("5 5");
      expect(s2?.strokeWidth).toBe(4);
      expect(s2?.hasArrow).toBe(false);
    } finally {
      await app.close();
    }
  });

  test("清空标签回到无标签", async () => {
    const doc = {
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 150, width: 120, height: 80 },
        { id: "b", kind: "text", props: { text: "B" }, x: 420, y: 150, width: 120, height: 80 },
      ],
      edges: [
        { id: "e1", sourceElementId: "a", targetElementId: "b", label: "LABEL_X", style: {} },
      ],
    };
    seedCanvas(doc as never);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await selectEdge(page);
      const label = page.getByTestId("canvas-edge-label");
      await expect(label).toContainText("LABEL_X");
      await label.click();
      // 内容可编辑区：End 移到尾部再逐字 Backspace 清空（与真实用户一致）
      await page.keyboard.press("End");
      for (let i = 0; i < 7; i++) await page.keyboard.press("Backspace");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => {
        const g = (
          window as unknown as {
            __x6graph?: { getEdges(): Array<{ getData(): { edge?: { label?: string | null } } }> };
          }
        ).__x6graph;
        return g?.getEdges()[0]?.getData()?.edge?.label ?? null;
      });
      expect(after).toBeNull();
    } finally {
      await app.close();
    }
  });
});
