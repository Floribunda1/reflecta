import { expect, test } from "@playwright/test";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  selectContext,
  threadByTitle,
  waitForAssistantReply,
} from "./agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-START-001 用户进入 Agent 页面后可以开始对话", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-thread-chat")).toBeVisible();
    await expect(page.getByTestId("agent-thread-sidebar")).toBeVisible();
    await expect(composer(page)).toBeEditable();
    await expect(page.getByTestId("agent-send-button")).toBeDisabled();
  } finally {
    await app.close();
  }
});

test("@AG-START-004 新对话标题使用第一条用户消息的可读内容", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await selectContext(page, "React", "React", "domain");
    await composer(page).click();
    await page.keyboard.type("请解释这个领域");
    await page.getByTestId("agent-send-button").click();
    await expect(page.getByTestId("agent-user-message")).toContainText("React");
    await waitForAssistantReply(page);

    const title = "React 请解释这个领域";
    await expect(threadByTitle(page, title)).toBeVisible();
    await expect(threadByTitle(page, title)).not.toContainText("domain:");
  } finally {
    await app.close();
  }
});

test("@AG-START-005 对话列表只收录已经发送消息的对话", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);

    await expect(page.getByTestId("agent-thread-item").filter({ hasText: "新对话" })).toHaveCount(
      0,
    );
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-START-007 用户打开等待回复中的对话时看到对话区等待状态", async () => {
  const sessionId = "waiting-reply";
  seedAgentThread({
    id: sessionId,
    title: "等待回复",
    messages: [
      userMessage("waiting-existing-user", "OLD_USER_MESSAGE"),
      assistantMessage("waiting-existing-assistant", [{ type: "text", text: "OLD_REPLY" }]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "等待回复");
    await app.evaluate(({ BrowserWindow }, sessionId) => {
      const window = BrowserWindow.getAllWindows()[0];
      const base = {
        sessionId,
        runId: "run-waiting",
        createdAt: "2026-06-25T05:20:00.000Z",
      };
      window?.webContents.send("agent:event", {
        ...base,
        id: "evt-waiting-run",
        type: "run.started",
      });
      window?.webContents.send("agent:event", {
        ...base,
        id: "evt-waiting-user",
        type: "user.message",
        messageId: "waiting-user",
        text: "WAITING_USER_MESSAGE",
      });
    }, sessionId);
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "WAITING_USER_MESSAGE" }),
    ).toBeVisible();
    await expect(page.getByTestId("agent-running-placeholder")).toContainText("正在思考");
    await expect(page.getByTestId("agent-empty-state")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@AG-START-008 用户收起后从对话标题重新展开对话列表", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-thread-title")).toBeVisible();
    await page.getByTestId("agent-sidebar-collapse-button").click();

    const sidebarContainer = page.getByTestId("agent-thread-sidebar-container");
    await expect(sidebarContainer).toHaveAttribute("aria-hidden", "true");
    await expect(sidebarContainer).toHaveCSS("width", "0px");
    await expect(page.getByTestId("agent-sidebar-expand-button")).toBeVisible();

    await page.getByTestId("agent-sidebar-expand-button").click();
    await expect(sidebarContainer).toHaveAttribute("aria-hidden", "false");
    await expect
      .poll(async () => (await sidebarContainer.boundingBox())?.width ?? 0)
      .toBeGreaterThan(270);
    await expect(page.getByTestId("agent-thread-sidebar")).toBeVisible();
    await expect(page.getByTestId("agent-sidebar-collapse-button")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-START-009 用户调整对话列表宽度", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-thread-title")).toBeVisible();
    const listPanel = page.getByTestId("agent-thread-sidebar-panel");
    const resizeHandle = page.getByTestId("agent-thread-sidebar-resize-handle");
    const handleBox = await resizeHandle.boundingBox();
    const initialBox = await listPanel.boundingBox();
    if (!handleBox || !initialBox) throw new Error("Thread list resize handle is not visible");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2, { steps: 8 });
    await expect
      .poll(async () => (await listPanel.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialBox.width + 70);
    await page.mouse.up();
    await expect(page.getByTestId("agent-thread-title")).toBeVisible();
  } finally {
    await page.mouse.up().catch(() => undefined);
    await app.close();
  }
});
