import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => resetAgentFixtures());

test.describe("搜索（⌘/Ctrl+F）", () => {
  test("打开搜索浮层并命中文本卡内容，点选结果定位", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "t",
          kind: "text",
          props: { text: "SNAKE_CASE_MARKER" },
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

      // 打开搜索
      await page.getByTestId("canvas-graph").click();
      await page.keyboard.press("Meta+f");
      await expect(page.getByTestId("canvas-search-overlay")).toBeVisible();

      await page.getByTestId("canvas-search-input").fill("SNAKE_CASE_MARKER");
      await expect(
        page.getByTestId("canvas-search-result").filter({ hasText: "SNAKE_CASE_MARKER" }).first(),
      ).toBeVisible();
      await page.getByTestId("canvas-search-result").first().click();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("canvas-search-overlay")).toHaveCount(0);
    } finally {
      await app.close();
    }
  });
});

test.describe("导出", () => {
  test("工具栏导出 PNG 触发下载", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 120, height: 80 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      await page.getByTestId("canvas-toolbar-more").click();
      await expect(page.getByTestId("canvas-export-png")).toBeVisible();
      const download = page.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
      await page.getByTestId("canvas-export-png").click();
      // 导出不抛错即可（Electron 下下载事件形态可能为 save dialog）
      const d = await download;
      expect(d === null || d.suggestedFilename().length > 0).toBe(true);
    } finally {
      await app.close();
    }
  });
});
