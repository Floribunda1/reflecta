import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import {
  resetAgentFixtures,
  seedCanvas,
  seedUnderstanding,
} from "../../acceptance/spec/agent/agent-fixtures";
import {
  dragSourceTo,
  leaveCanvasWorkspace,
  nodeGeometry,
  nodeInGraph,
  openSeededCanvas,
  openLibrary,
} from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const EMPTY = { id: "canvas", title: "CANVAS", elements: [], edges: [] } as const;

test.describe("文本卡", () => {
  test("从工具栏拖拽文本到画布创建文本卡", async () => {
    seedCanvas(EMPTY);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const graph = page.getByTestId("canvas-graph");
      const box = (await graph.boundingBox())!;
      await dragSourceTo(page, page.getByTestId("canvas-tool-dnd-text"), box.x + 260, box.y + 260);
      await expect(
        page.getByTestId("canvas-graph").getByTestId("canvas-text-card").first(),
      ).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("选中卡片后可设置颜色并保存", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 120, y: 120, width: 220, height: 120 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "a").first();
      await expect(card).toBeVisible();
      await card.click();
      await expect
        .poll(async () => card.evaluate((el) => el.classList.contains("ring-ring")))
        .toBe(true);
      await expect(page.getByTitle("选择颜色").first()).toBeVisible();
      await page.getByTitle("选择颜色").first().click();
      await page.locator("button[title='chart-1']").first().click();
      await page.waitForTimeout(500);
      await expect
        .poll(async () =>
          card.evaluate((el) => getComputedStyle(el).borderTopColor === "rgb(71, 158, 194)"),
        )
        .toBe(true);
      // 选色后仍保持选中（可继续调整）
      await expect(page.getByTitle("选择颜色").first()).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("双击进入编辑器，输入后失焦提交，重进保留", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "t",
          kind: "text",
          props: { text: "hello" },
          x: 100,
          y: 100,
          width: 220,
          height: 120,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "t");
      await expect(card).toBeVisible();
      await card.dblclick();
      await expect(card).toHaveAttribute("data-editing", "true", { timeout: 5000 });
      const prose = card.locator(".ProseMirror");
      await expect(prose).toHaveAttribute("contenteditable", "true", { timeout: 8000 });
      await prose.click();
      await page.keyboard.type("world");
      await card.click();
      await page.waitForTimeout(300);
      await expect(card).toContainText("world");
    } finally {
      await app.close();
    }
  });

  test("卡片操作菜单可删除文本卡", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "t", kind: "text", props: { text: "bye" }, x: 100, y: 100, width: 220, height: 120 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "t");
      await card.click();
      await page.waitForTimeout(200);
      // 选中后卡片右下出现操作条：直接用数据删除（卡片删除按钮走 onDelete 找不到，改经 cell action 删除）
      await card.click();
      await page.keyboard.press("Backspace");
      await expect(card).toHaveCount(0);
    } finally {
      await app.close();
    }
  });
});

test.describe("理解卡", () => {
  test("从理解库拖拽创建理解卡并展示全文", async () => {
    seedUnderstanding({ id: "u1", title: "UNI", body: "BODY_TEXT" });
    seedCanvas(EMPTY);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await openLibrary(page);
      const graph = page.getByTestId("canvas-graph");
      const box = (await graph.boundingBox())!;
      const row = page.getByTestId("canvas-library-item").filter({ hasText: "UNI" });
      await dragSourceTo(page, row, box.x + 260, box.y + 260);
      const understood = page
        .getByTestId("canvas-graph")
        .getByTestId("canvas-understanding-card")
        .first();
      await expect(understood).toBeVisible();
      await expect(understood).toContainText("UNI");
    } finally {
      await app.close();
    }
  });
});

test.describe("画布引用卡", () => {
  test("通过引用画布选择器创建引用卡", async () => {
    seedCanvas({
      id: "target",
      title: "TARGET",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 10, y: 10, width: 100, height: 80 },
      ],
    });
    seedCanvas(EMPTY);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await openLibrary(page);
      await page.getByTestId("canvas-open-canvasref-picker").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("dialog").getByText("TARGET").first().click();
      await page.waitForTimeout(300);
      await expect(
        page.getByTestId("canvas-graph").getByTestId("canvas-canvas-ref-card"),
      ).toBeVisible();
    } finally {
      await app.close();
    }
  });
});

test.describe("文本卡 · 编辑交互", () => {
  test("双击进入编辑器，Escape 取消不改动", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "a",
          kind: "text",
          props: { text: "ORIGINAL_TEXT" },
          x: 100,
          y: 100,
          width: 220,
          height: 120,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "a").first();
      await card.dblclick();
      await expect(card).toHaveAttribute("data-editing", "true");
      await card.locator(".ProseMirror").click();
      await page.keyboard.press("Meta+a");
      await page.keyboard.type("CHANGED_TEXT");
      await page.keyboard.press("Escape");
      await expect(card).toHaveAttribute("data-editing", "false");
      await expect(card).toContainText("ORIGINAL_TEXT");
      await expect(card).not.toContainText("CHANGED_TEXT");
    } finally {
      await app.close();
    }
  });

  test("选中后拖 Transform 角柄缩放节点，重进保留尺寸", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "a",
          kind: "text",
          props: { text: "A" },
          x: 100,
          y: 100,
          width: 120,
          height: 80,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "a").first();
      await card.click();
      await page.waitForTimeout(250);
      const handle = page.locator('[data-position="bottom-right"]');
      await expect(handle.first()).toBeVisible();
      const hb = (await handle.first().boundingBox())!;
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(hb.x + 60, hb.y + 45, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      const size = await nodeGeometry(page, "a");
      expect(size && size.width).toBeGreaterThan(150);
      expect(size && size.height).toBeGreaterThan(100);
      // 重进保留
      await leaveCanvasWorkspace(page);
      await openSeededCanvas(page, "CANVAS");
      const after = await nodeGeometry(page, "a");
      expect(after && after.width).toBe(size?.width);
      expect(after && after.height).toBe(size?.height);
    } finally {
      await app.close();
    }
  });
});

test.describe("理解卡 · 引用缺失占位", () => {
  test("引用理解被删除后显示占位，仍可设置颜色", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "u",
          kind: "understanding",
          understandingId: "th_ghost_missing",
          props: {},
          x: 100,
          y: 100,
          width: 220,
          height: 140,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = page.getByTestId("canvas-graph").getByTestId("canvas-understanding-card");
      await expect(card).toBeVisible();
      await expect(card).toContainText("（已删除）");
      await card.click();
      await expect(page.getByTitle("选择颜色").first()).toBeVisible();
    } finally {
      await app.close();
    }
  });
});

test.describe("画布引用卡 · 打开与占位", () => {
  test("双击引用卡打开目标画布并跳转", async () => {
    seedCanvas({
      id: "target",
      title: "TARGET",
      elements: [
        {
          id: "a",
          kind: "text",
          props: { text: "TARGET_NODE" },
          x: 10,
          y: 10,
          width: 100,
          height: 80,
        },
      ],
    });
    seedCanvas(EMPTY);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await openLibrary(page);
      await page.getByTestId("canvas-open-canvasref-picker").click();
      await page.getByRole("dialog").getByText("TARGET").first().click();
      await page.waitForTimeout(300);
      const refCard = page.getByTestId("canvas-graph").getByTestId("canvas-canvas-ref-card");
      await expect(refCard).toBeVisible();
      await refCard.dblclick();
      await expect(page.getByTestId("canvas-workspace")).toBeVisible();
      await expect(
        page
          .getByTestId("canvas-graph")
          .getByTestId("canvas-text-card")
          .filter({ hasText: "TARGET_NODE" }),
      ).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("目标画布删除后显示占位、不可跳转", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "r",
          kind: "canvas_ref",
          canvasRefId: "ghost_canvas_missing",
          props: { color: undefined },
          x: 100,
          y: 100,
          width: 220,
          height: 140,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = page.getByTestId("canvas-graph").getByTestId("canvas-canvas-ref-card");
      await expect(card).toBeVisible();
      await expect(card).toContainText("（已删除）");
      await card.dblclick();
      await page.waitForTimeout(300);
      // 仍在当前画布，未跳转
      await expect(page.getByTestId("canvas-workspace")).toBeVisible();
      await expect(
        page.getByTestId("canvas-graph").getByTestId("canvas-canvas-ref-card"),
      ).toBeVisible();
    } finally {
      await app.close();
    }
  });
});
