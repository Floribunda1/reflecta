import { expect, test } from "@playwright/test";
import { getE2eAiEnv, writeE2eAiConfig } from "../test-env";
import {
  composer,
  configureE2eAiKey,
  createNewThread,
  hasAi,
  launchAgentPage,
  selectContext,
  sendMessage,
  threadByTitle,
  waitForAssistantReply,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

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
    await selectContext(page, "React", "React", "category");
    await composer(page).click();
    await page.keyboard.type("请解释这个分类");
    await page.getByTestId("agent-send-button").click();
    await expect(page.getByTestId("agent-user-message")).toContainText("React");
    await waitForAssistantReply(page);

    const title = "React 请解释这个分类";
    await expect(threadByTitle(page, title)).toBeVisible();
    await expect(threadByTitle(page, title)).not.toContainText("category:");
  } finally {
    await app.close();
  }
});
