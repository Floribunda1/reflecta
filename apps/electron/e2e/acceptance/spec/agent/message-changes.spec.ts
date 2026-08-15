import { expect, test } from "@playwright/test";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  sendMessage,
  waitForAssistantReply,
} from "./agent-e2e";
import { resetAgentFixtures, seedCompletedThread } from "./agent-fixtures";
import { writeE2eAiConfig } from "../../../test-env";

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

    const originalMessage = page
      .locator('[data-testid="agent-message-row"][data-message-role="user"]')
      .filter({ hasText: "ORIGINAL_USER_MESSAGE" });
    await composer(page).fill("PRESERVED_DRAFT");
    await originalMessage.hover();
    await originalMessage.getByTestId("agent-edit-message-button").click();
    const editRow = page.getByTestId("agent-message-edit-row");
    const editEditor = page
      .getByTestId("agent-message-edit-editor")
      .locator('[contenteditable="true"]');
    const assistantMessage = page
      .locator('[data-testid="agent-message-row"][data-message-role="assistant"]')
      .last();
    await expect(editEditor).toContainText("ORIGINAL_USER_MESSAGE");
    await expect
      .poll(async () => {
        const [editBox, assistantBox] = await Promise.all([
          editRow.boundingBox(),
          assistantMessage.boundingBox(),
        ]);
        return editBox && assistantBox ? editBox.y + editBox.height <= assistantBox.y : false;
      })
      .toBe(true);
    await expect(composer(page)).toContainText("PRESERVED_DRAFT");
    await editEditor.fill("EDITED_USER_MESSAGE。请直接回复 EDITED_AGENT_REPLY，不要调用任何工具。");
    await page.getByTestId("agent-message-edit-submit").click();
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
    await expect(composer(page)).toContainText("PRESERVED_DRAFT");
  } finally {
    await app.close();
  }
});

test("@AG-MESSAGE-005 用户取消编辑后保留原对话和底部草稿", async () => {
  seedCompletedThread({
    id: "cancel-message-edit",
    title: "取消消息编辑",
    userText: "CANCEL_EDIT_USER_MESSAGE",
    assistantText: "CANCEL_EDIT_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "取消消息编辑");
    const originalMessage = page
      .locator('[data-testid="agent-message-row"][data-message-role="user"]')
      .filter({ hasText: "CANCEL_EDIT_USER_MESSAGE" });
    await composer(page).fill("PRESERVED_DRAFT");
    await originalMessage.hover();
    await originalMessage.getByTestId("agent-edit-message-button").click();
    await page
      .getByTestId("agent-message-edit-editor")
      .locator('[contenteditable="true"]')
      .fill("UNSAVED_EDIT");
    await page.getByTestId("agent-message-edit-cancel").click();

    await expect(page.getByTestId("agent-message-edit-row")).toHaveCount(0);
    await expect(originalMessage).toBeVisible();
    await expect(
      page.getByTestId("agent-assistant-text").filter({ hasText: "CANCEL_EDIT_AGENT_REPLY" }),
    ).toBeVisible();
    await expect(composer(page)).toContainText("PRESERVED_DRAFT");
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

test("@AG-MESSAGE-003 用户复制一条消息后剪贴板包含该消息正文", async () => {
  seedCompletedThread({
    id: "copy-message",
    title: "复制消息",
    userText: "COPY_USER_MESSAGE",
    assistantText: "COPY_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "复制消息");
    const userRow = page
      .locator('[data-testid="agent-message-row"][data-message-role="user"]')
      .filter({ hasText: "COPY_USER_MESSAGE" });
    await userRow.hover();
    await userRow.getByTestId("agent-copy-message-button").click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("COPY_USER_MESSAGE");
    await expect(userRow).toBeVisible();
    await expect(
      page.getByTestId("agent-assistant-text").filter({ hasText: "COPY_AGENT_REPLY" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-MESSAGE-004 Agent 回复期间用户可以整理下一轮想法", async () => {
  test.setTimeout(120_000);
  writeE2eAiConfig({ ...process.env, REFLECTA_E2E_AI_API_KEY: "invalid-reflecta-e2e-key" });

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await composer(page).fill("FIRST_TURN");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("agent-stop-button")).toBeVisible();

    await composer(page).fill("NEXT_TURN_DRAFT");
    await page.keyboard.press("Enter");
    await page.keyboard.type("SECOND_LINE");

    await expect(composer(page)).toContainText("NEXT_TURN_DRAFT");
    await expect(composer(page)).toContainText("SECOND_LINE");
    await expect(composer(page)).toBeEditable();
    await expect(page.getByTestId("agent-user-message")).toHaveCount(1);
  } finally {
    await app.close();
  }
});
