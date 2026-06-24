import { expect, type Page, test } from "@playwright/test";
import { composer, launchApp } from "../agent/agent-e2e";

const PROGRAMMING_HISTORY_USER_MESSAGE = "历史讨论：Programming";
const PROGRAMMING_HISTORY_REPLY = "这是一条 Programming 的上下文历史对话。";

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

test("@CT-AGENT-004 用户从图谱上下文 Agent 恢复历史对话并新建对话", async () => {
  const { app, page } = await launchApp();

  try {
    await openContemplatePage(page);
    await page
      .locator('[data-testid="contemplate-domain-node"][data-domain-name="Programming"]')
      .click({ button: "right" });
    await chooseChatFromContextMenu(page);

    const dock = page.getByTestId("contemplate-agent-dock");
    await expect(dock).toBeVisible();
    await expect(dock.getByTestId("contextual-agent-title")).toHaveText("Programming");
    await expect(contextMention(page, "Programming")).toBeVisible();

    const backgroundColor = await dock.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(backgroundColor).not.toBe("transparent");
    expect(backgroundColor).not.toMatch(/^rgba\([^,]+,[^,]+,[^,]+,\s*0(?:\.0+)?\)$/);

    await dock.getByTestId("contextual-agent-history-button").click();
    await page
      .getByTestId("contextual-agent-history-thread")
      .filter({ hasText: PROGRAMMING_HISTORY_USER_MESSAGE })
      .click();

    await expect(
      dock.getByTestId("agent-user-message").filter({ hasText: PROGRAMMING_HISTORY_USER_MESSAGE }),
    ).toBeVisible();
    await expect(
      dock.getByTestId("agent-assistant-text").filter({ hasText: PROGRAMMING_HISTORY_REPLY }),
    ).toBeVisible();

    await dock.getByTestId("contextual-agent-new-button").click();

    await expect(contextMention(page, "Programming")).toBeVisible();
    await expect(
      dock.getByTestId("agent-user-message").filter({ hasText: PROGRAMMING_HISTORY_USER_MESSAGE }),
    ).toHaveCount(0);
  } finally {
    await app.close();
  }
});
