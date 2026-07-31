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
