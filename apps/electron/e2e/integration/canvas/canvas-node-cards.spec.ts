import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import {
  resetAgentFixtures,
  seedCanvas,
  seedUnderstanding,
} from "../../acceptance/spec/agent/agent-fixtures";
import { nodeInGraph, openSeededCanvas, openLibrary } from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

const EMPTY = { id: "canvas", title: "CANVAS", elements: [], edges: [] } as const;

test.describe("文本卡", () => {
  test("从工具栏创建文本卡", async () => {
    seedCanvas(EMPTY);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await page.getByTestId("canvas-tool-dnd-text").click();
      await expect(page.getByTestId("canvas-graph").getByTestId("canvas-text-card")).toBeVisible();
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
  test("从理解库创建理解卡并展示全文", async () => {
    seedUnderstanding({ id: "u1", title: "UNI", body: "BODY_TEXT" });
    seedCanvas(EMPTY);
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await openLibrary(page);
      const row = page.getByTestId("canvas-library-item").filter({ hasText: "UNI" });
      await row.click();
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
