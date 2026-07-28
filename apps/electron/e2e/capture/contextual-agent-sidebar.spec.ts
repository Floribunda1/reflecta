import { expect, type Page, test } from "@playwright/test";
import { composer, launchAgentPage, launchApp, selectContext } from "../agent/agent-e2e";
import { resetAgentFixtures } from "../agent/agent-fixtures";
import { domainNode, openCapturePage } from "./capture-e2e";

test.beforeEach(() => {
  resetAgentFixtures();
});

function contextMention(page: Page, title: string) {
  return page.locator('[data-slot="composer-context-mention"]').filter({ hasText: title });
}

async function chooseChatFromContextMenu(page: Page) {
  await page.getByRole("menuitem", { name: "和 AI 聊聊" }).click();
}

async function expectAgentDockWithContext(page: Page, title: string) {
  await expect(page.getByTestId("capture-agent-dock")).toBeVisible();
  await expect(page.getByTestId("capture-agent-dock")).toContainText(title);
  await expect(contextMention(page, title)).toBeVisible();
  await expect(composer(page)).toBeEditable();
  await expect(composer(page)).toBeFocused();
}

test("@CP-AGENT-001 用户从 Domain 右键菜单打开上下文 Agent", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click({ button: "right" });
    await chooseChatFromContextMenu(page);

    await expectAgentDockWithContext(page, "Programming");
  } finally {
    await app.close();
  }
});

test("@CP-AGENT-002 用户从 Understanding 列表右键菜单打开上下文 Agent", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await page
      .locator(
        '[data-testid="capture-understanding-row"][data-understanding-title="React Server Components"]',
      )
      .click({ button: "right" });
    await chooseChatFromContextMenu(page);

    await expectAgentDockWithContext(page, "React Server Components");
  } finally {
    await app.close();
  }
});

test("@CP-AGENT-003 用户从 Understanding 详情页按钮打开上下文 Agent", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await page
      .locator(
        '[data-testid="capture-understanding-row"][data-understanding-title="React Server Components"]',
      )
      .click();
    await expect(page.getByTestId("capture-understanding-chat-button")).toBeVisible();
    await page.getByTestId("capture-understanding-chat-button").click();

    await expectAgentDockWithContext(page, "React Server Components");
  } finally {
    await app.close();
  }
});

test("@CP-AGENT-004 用户在 Agent 页面内检查 Understanding 详情", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await selectContext(page, "React", "React Server Components", "understanding");
    await contextMention(page, "React Server Components").click();

    const inspector = page.getByTestId("agent-context-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
      { timeout: 15_000 },
    );
    await expect(inspector.locator(".ProseMirror")).toContainText(
      "RSC allows server-side rendering of components",
    );
    await inspector.getByLabel("关闭详情").click();
    await expect(inspector).toHaveCount(0);
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@CP-AGENT-005 对话列表只收录已发送消息的 Capture 上下文对话", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click({ button: "right" });
    await chooseChatFromContextMenu(page);
    await expectAgentDockWithContext(page, "Programming");

    await page.getByTestId("app-module-switcher").click();
    await expect(page.getByTestId("agent-page")).toBeVisible();
    await expect(
      page.getByTestId("agent-thread-item").filter({ hasText: "聊聊：Programming" }),
    ).toHaveCount(0);
  } finally {
    await app.close();
  }
});
