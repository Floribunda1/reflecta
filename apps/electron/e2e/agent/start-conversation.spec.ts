import { expect, test } from "@playwright/test";
import { getE2eAiEnv, writeE2eAiConfig } from "../test-env";
import {
  composer,
  configureE2eAiKey,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  selectContext,
  sendMessage,
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

test("@AG-START-002 用户发送第一条消息后看到完整回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await sendMessage(page, "hello");
    await expect(
      page.getByTestId("agent-stop-button").or(page.getByTestId("agent-assistant-text").last()),
    ).toBeVisible({ timeout: 15_000 });
    await waitForAssistantReply(page);
    await expect(page.getByTestId("agent-thread-item").filter({ hasText: "hello" })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-START-003 回复失败后用户可以继续发送消息", async () => {
  const apiKey = getE2eAiEnv().apiKey;
  test.skip(!apiKey, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  writeE2eAiConfig({ ...process.env, REFLECTA_E2E_AI_API_KEY: "invalid-reflecta-e2e-key" });
  const { app, page } = await launchAgentPage();

  try {
    await sendMessage(page, "first");
    await expect(page.getByTestId("agent-error-banner")).toContainText("回复失败", {
      timeout: 60_000,
    });
    await expect(composer(page)).toBeEditable();

    await configureE2eAiKey(page, apiKey);
    await sendMessage(page, "second");
    await waitForAssistantReply(page);

    await expect(page.getByTestId("agent-user-message").filter({ hasText: "first" })).toBeVisible();
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "second" }),
    ).toBeVisible();
    await expect(composer(page)).toBeEditable();
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

test("@AG-START-005 未发送消息的新对话不进入对话列表", async () => {
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
