import { expect, test } from "@playwright/test";
import { writeE2eAiConfig } from "../test-env";
import {
  composer,
  configureOpenAiKey,
  createNewThread,
  hasAi,
  launchAgentPage,
  sendMessage,
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
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY or OPENAI_API_KEY");
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
  const apiKey = process.env.REFLECTA_E2E_AI_API_KEY || process.env.OPENAI_API_KEY || "";
  test.skip(!apiKey, "requires REFLECTA_E2E_AI_API_KEY or OPENAI_API_KEY");
  test.setTimeout(240_000);

  writeE2eAiConfig({ ...process.env, REFLECTA_E2E_AI_API_KEY: "invalid-reflecta-e2e-key" });
  const { app, page } = await launchAgentPage();

  try {
    await sendMessage(page, "first");
    await expect(page.getByTestId("agent-error-banner")).toContainText("回复失败", {
      timeout: 60_000,
    });
    await expect(composer(page)).toBeEditable();

    await configureOpenAiKey(page, apiKey);
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
