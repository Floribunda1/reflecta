import { expect, test } from "@playwright/test";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  sendMessage,
  waitForAssistantReply,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";
import { writeE2eAiConfig } from "../test-env";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-MESSAGE-001 用户编辑历史消息后看到新的当前回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      "ORIGINAL_USER_MESSAGE。请直接回复 ORIGINAL_AGENT_REPLY，不要调用任何工具。",
    );
    await waitForAssistantReply(page);

    await page
      .locator('[data-testid="agent-message-row"][data-message-role="user"]')
      .filter({ hasText: "ORIGINAL_USER_MESSAGE" })
      .hover();
    await page.getByTestId("agent-edit-message-button").click();
    await page
      .getByTestId("agent-composer-editor")
      .locator('[contenteditable="true"]')
      .fill("EDITED_USER_MESSAGE。请直接回复 EDITED_AGENT_REPLY，不要调用任何工具。");
    await page.getByTestId("agent-send-button").click();
    await waitForAssistantReply(page);

    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "EDITED_USER_MESSAGE" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "ORIGINAL_USER_MESSAGE" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("agent-message-row")).toHaveCount(2);
    await expect(page.getByTestId("agent-message-row").nth(0)).toHaveAttribute(
      "data-message-role",
      "user",
    );
    await expect(page.getByTestId("agent-message-row").nth(1)).toHaveAttribute(
      "data-message-role",
      "assistant",
    );
  } finally {
    await app.close();
  }
});

test("@AG-MESSAGE-002 用户重新生成回复后看到新的当前回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      "REGENERATE_USER_MESSAGE。请直接回复 REGENERATE_AGENT_REPLY，不要调用任何工具。",
    );
    await waitForAssistantReply(page);

    await page.getByTestId("agent-message-row").nth(1).hover();
    await page.getByTestId("agent-regenerate-button").click();
    await waitForAssistantReply(page);

    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "REGENERATE_USER_MESSAGE" }),
    ).toBeVisible();
    await expect(page.getByTestId("agent-message-row")).toHaveCount(2);
    await expect(page.getByTestId("agent-message-row").nth(0)).toHaveAttribute(
      "data-message-role",
      "user",
    );
    await expect(page.getByTestId("agent-message-row").nth(1)).toHaveAttribute(
      "data-message-role",
      "assistant",
    );
  } finally {
    await app.close();
  }
});

test("@AG-MESSAGE-003 用户按 Enter 发送后编辑时仍看到原来的单行内容", async () => {
  test.setTimeout(120_000);
  writeE2eAiConfig({ ...process.env, REFLECTA_E2E_AI_API_KEY: "invalid-reflecta-e2e-key" });

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await composer(page).click();
    await page.keyboard.type("ENTER_SEND_SINGLE_LINE");
    await page.keyboard.press("Enter");

    const userRow = page
      .locator('[data-testid="agent-message-row"][data-message-role="user"]')
      .filter({ hasText: "ENTER_SEND_SINGLE_LINE" });
    await expect(userRow).toBeVisible();
    await expect(page.getByTestId("agent-stop-button")).toBeVisible();
    await expect(page.getByTestId("agent-stop-button")).toBeEnabled();
    await page.getByTestId("agent-stop-button").click();
    await expect(page.getByTestId("agent-stop-button")).toBeHidden();

    await userRow.hover();
    await userRow.getByTestId("agent-edit-message-button").click();

    await expect(composer(page)).toContainText("ENTER_SEND_SINGLE_LINE");
    await expect
      .poll(() => composer(page).evaluate((node) => node.textContent))
      .toBe("ENTER_SEND_SINGLE_LINE");
  } finally {
    await app.close();
  }
});
