import { expect, test } from "@playwright/test";
import { composer, launchAgentPage, selectContext } from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-CONTEXT-004 用户通过 @ 搜索选择上下文引用", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await composer(page).click();
    await page.keyboard.type("@React");
    await expect(page.getByTestId("agent-context-picker")).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .locator('[data-testid="agent-context-option"][data-context-type="understanding"]')
        .filter({ hasText: "React Server Components" }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="agent-context-option"][data-context-type="domain"]')
        .filter({ hasText: "React" }),
    ).toBeVisible();

    await page
      .locator('[data-testid="agent-context-option"][data-context-type="understanding"]')
      .filter({ hasText: "React Server Components" })
      .first()
      .click();
    await expect(
      page.locator('[data-slot="composer-context-mention"]').filter({
        hasText: "React Server Components",
      }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-009 用户通过 @ 搜索后按 Enter 选择上下文引用", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await composer(page).click();
    await page.keyboard.type("@React");
    await expect(page.getByTestId("agent-context-picker")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("agent-context-option").first()).toBeVisible();
    const messageCountBeforeEnter = await page.getByTestId("agent-user-message").count();
    await page.keyboard.press("Enter");

    await expect(composer(page).locator('[data-slot="composer-context-mention"]')).toBeVisible();
    await expect(page.getByTestId("agent-user-message")).toHaveCount(messageCountBeforeEnter);
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-005 用户点击已选择的 Understanding 引用后查看详情", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await selectContext(page, "React", "React Server Components", "understanding");
    await page
      .locator('[data-slot="composer-context-mention"]')
      .filter({ hasText: "React Server Components" })
      .click();
    await expect(page.getByTestId("agent-context-inspector")).toBeVisible();
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
      { timeout: 15_000 },
    );
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-008 用户粘贴 Markdown 文本后继续编辑纯文本草稿", async () => {
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
