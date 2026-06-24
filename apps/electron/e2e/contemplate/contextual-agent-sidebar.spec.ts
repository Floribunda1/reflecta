import { expect, type Page, test } from "@playwright/test";
import { composer, launchApp } from "../agent/agent-e2e";
import { resetAgentFixtures } from "../agent/agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

async function openContemplatePage(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("contemplate:selectedDomainIds");
    localStorage.removeItem("contemplate:showAllDescendants");
  });
  await page.getByLabel("Switch module").click();
  await page.getByRole("menuitem", { name: "Contemplate" }).click();
  await expect(page.getByTestId("contemplate-page")).toBeVisible();
}

function contextMention(page: Page, title: string) {
  return page.locator('[data-slot="composer-context-mention"]').filter({ hasText: title });
}

async function chooseChatFromContextMenu(page: Page) {
  await page.getByRole("menuitem", { name: "和 AI 聊聊" }).click();
}

async function expectAgentDockWithContext(page: Page, title: string) {
  await expect(page.getByTestId("contemplate-agent-dock")).toBeVisible();
  await expect(page.getByTestId("contemplate-agent-dock")).toContainText(title);
  await expect(contextMention(page, title)).toBeVisible();
  await expect(composer(page)).toBeEditable();
  await expect(composer(page)).toBeFocused();
}

async function openReactFocusGraph(page: Page) {
  await openContemplatePage(page);
  await page.locator('[data-testid="contemplate-domain-node"][data-domain-name="React"]').click();
}

function reactServerComponentsNode(page: Page) {
  return page.locator(
    '[data-testid="contemplate-understanding-node"][data-understanding-title="React Server Components"]',
  );
}

test("@CT-AGENT-001 用户从图谱 Domain 节点右键菜单打开上下文 Agent", async () => {
  const { app, page } = await launchApp();

  try {
    await openContemplatePage(page);
    await page
      .locator('[data-testid="contemplate-domain-node"][data-domain-name="Programming"]')
      .click({ button: "right" });
    await chooseChatFromContextMenu(page);

    await expectAgentDockWithContext(page, "Programming");
  } finally {
    await app.close();
  }
});

test("@CT-AGENT-002 用户从图谱 Understanding 节点右键菜单打开上下文 Agent", async () => {
  const { app, page } = await launchApp();

  try {
    await openReactFocusGraph(page);
    await reactServerComponentsNode(page).click({ button: "right" });
    await chooseChatFromContextMenu(page);

    await expectAgentDockWithContext(page, "React Server Components");
  } finally {
    await app.close();
  }
});

test("@CT-AGENT-003 图谱 Understanding 详情面板不显示 Capture 专属聊天入口", async () => {
  const { app, page } = await launchApp();

  try {
    await openReactFocusGraph(page);
    await reactServerComponentsNode(page).click();

    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("capture-understanding-chat-button")).toHaveCount(0);
  } finally {
    await app.close();
  }
});
