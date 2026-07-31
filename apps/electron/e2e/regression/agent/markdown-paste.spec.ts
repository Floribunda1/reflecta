import { expect, test } from "@playwright/test";
import { composer, launchAgentPage } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures } from "../../acceptance/spec/agent/agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("pasting Markdown keeps the editor content as editable source text", async () => {
  const { app, page } = await launchAgentPage();

  try {
    const editor = composer(page);
    await editor.click();
    await page.evaluate(() => {
      const target = document.querySelector(
        '[data-testid="agent-composer-editor"] [contenteditable="true"]',
      );
      if (!target) throw new Error("composer editor not found");

      const data = new DataTransfer();
      data.setData("text/plain", "## Context 候选项\n\n**medium:** ai");
      data.setData("text/html", "<h2>Context 候选项</h2><p><strong>medium:</strong> ai</p>");
      target.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      );
    });

    await expect(editor).toContainText("## Context 候选项");
    await expect(editor).toContainText("**medium:** ai");
    await expect(editor.locator("strong, b, h1, h2, h3, ul, ol")).toHaveCount(0);

    await page.keyboard.type(" 123");
    await expect(editor).toContainText("**medium:** ai 123");
    await expect(editor.locator("strong, b").filter({ hasText: "123" })).toHaveCount(0);
  } finally {
    await app.close();
  }
});
