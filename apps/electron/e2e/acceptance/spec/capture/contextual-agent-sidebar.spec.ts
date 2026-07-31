import { expect, type Page, test } from "@playwright/test";
import { composer, launchAgentPage, launchApp, selectContext } from "../agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "../agent/agent-fixtures";
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
    const threadHeader = page.getByTestId("agent-thread-title").locator("xpath=ancestor::header");
    const inspectorHeader = inspector.locator(":scope > div").first();
    expect(
      await inspectorHeader.evaluate((element) => element.getBoundingClientRect().height),
    ).toBe(await threadHeader.evaluate((element) => element.getBoundingClientRect().height));
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

test("@CP-AGENT-006 用户在上下文 Agent 中继续历史对话并开始新对话", async () => {
  seedAgentThread({
    id: "context-history-thread",
    title: "历史上下文对话",
    messages: [
      userMessage("context-history-user", "HISTORY_CONTEXT_MESSAGE"),
      assistantMessage("context-history-assistant", [{ type: "text", text: "历史回复" }]),
    ],
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click({ button: "right" });
    await chooseChatFromContextMenu(page);
    await expectAgentDockWithContext(page, "Programming");

    await page.getByTestId("contextual-agent-history-button").click();
    await page
      .getByTestId("contextual-agent-history-thread")
      .filter({ hasText: "历史上下文对话" })
      .click();
    await expect(page.getByText("HISTORY_CONTEXT_MESSAGE")).toBeVisible();

    await page.getByTestId("contextual-agent-new-button").click();
    await expect(contextMention(page, "Programming")).toBeVisible();
    await expect(composer(page)).toBeEditable();
    await expect(page.getByText("HISTORY_CONTEXT_MESSAGE")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CP-AGENT-007 用户把当前上下文对话转到完整 Agent 页面", async () => {
  seedAgentThread({
    id: "context-jump-thread",
    title: "待转到完整 Agent 的对话",
    messages: [
      userMessage("context-jump-user", "CONTEXT_JUMP_MESSAGE"),
      assistantMessage("context-jump-assistant", [{ type: "text", text: "跳转前的回复" }]),
    ],
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click({ button: "right" });
    await chooseChatFromContextMenu(page);
    await expectAgentDockWithContext(page, "Programming");

    await page.getByTestId("contextual-agent-history-button").click();
    await page
      .getByTestId("contextual-agent-history-thread")
      .filter({ hasText: "待转到完整 Agent 的对话" })
      .click();
    await expect(page.getByText("CONTEXT_JUMP_MESSAGE")).toBeVisible();

    await page.getByTestId("contextual-agent-jump-button").click();
    await expect(page.getByTestId("agent-page")).toBeVisible();
    await expect(page.getByTestId("agent-thread-title")).toHaveValue("待转到完整 Agent 的对话");
    await expect(page.getByText("CONTEXT_JUMP_MESSAGE")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-AGENT-008 用户调整并关闭上下文 Agent", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click({ button: "right" });
    await chooseChatFromContextMenu(page);
    await expectAgentDockWithContext(page, "Programming");

    const dock = page.getByTestId("capture-agent-dock");
    const initialBox = await dock.boundingBox();
    const handle = page.locator("#capture-agent-dock-resize-handle");
    const handleBox = await handle.boundingBox();
    if (!initialBox || !handleBox) throw new Error("Contextual Agent resize handle is not visible");
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () => (await dock.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialBox.width + 60);

    await dock.getByRole("button", { name: "关闭 Agent" }).click();
    await expect(dock).toHaveCount(0);
    await expect(page.getByTestId("capture-understanding-list-panel")).toBeVisible();
  } finally {
    await page.mouse.up().catch(() => undefined);
    await app.close();
  }
});
