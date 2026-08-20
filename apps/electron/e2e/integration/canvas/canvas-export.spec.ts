import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("导出 PNG 收纳在 header 右上角 more（⋯）菜单", async () => {
  seedCanvas({
    id: "canvas",
    title: "EXPORT",
    elements: [
      { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 200, height: 120 },
    ],
  });
  const { app, page } = await launchApp();
  try {
    await openSeededCanvas(page, "EXPORT");
    // more 菜单在 header 右上角（PageTopBar actions 区）
    const more = page.getByTestId("canvas-toolbar-more");
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.getByTestId("canvas-export-png")).toBeVisible();
  } finally {
    await app.close();
  }
});
