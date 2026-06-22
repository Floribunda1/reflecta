import { expect, test } from "@playwright/test";
import { composer, launchAgentPage, openAgentPage, openThread, threadByTitle } from "./agent-e2e";
import {
  assistantMessage,
  proposalPart,
  resetAgentFixtures,
  seedAgentThread,
  seedCompletedThread,
  userMessage,
} from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-HISTORY-001 用户重启应用后仍能看到已完成对话", async () => {
  seedCompletedThread({
    id: "history-completed",
    title: "HISTORY_USER_MESSAGE",
    userText: "HISTORY_USER_MESSAGE",
    assistantText: "HISTORY_AGENT_REPLY",
  });

  const first = await launchAgentPage();
  await first.app.close();

  const { app, page } = await launchAgentPage();
  try {
    await openThread(page, "HISTORY_USER_MESSAGE");
    await expect(page.getByTestId("agent-user-message")).toContainText("HISTORY_USER_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("HISTORY_AGENT_REPLY");
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-HISTORY-002 用户重启应用后对话列表和消息顺序保持一致", async () => {
  seedCompletedThread({
    id: "history-order",
    title: "HISTORY_ORDER_USER_MESSAGE",
    userText: "HISTORY_ORDER_USER_MESSAGE",
    assistantText: "HISTORY_ORDER_AGENT_REPLY",
  });

  const first = await launchAgentPage();
  await first.app.close();

  const { app, page } = await launchAgentPage();
  try {
    await expect(threadByTitle(page, "HISTORY_ORDER_USER_MESSAGE")).toBeVisible();
    await openThread(page, "HISTORY_ORDER_USER_MESSAGE");
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

test("@AG-HISTORY-003 用户离开后仍可处理等待确认的提案", async () => {
  seedAgentThread({
    id: "history-proposal",
    title: "等待确认提案",
    messages: [
      userMessage("history-proposal-user", "请创建一个 Thought"),
      assistantMessage("history-proposal-assistant", [
        proposalPart({
          toolCallId: "history-proposal-tool",
          title: "CANDIDATE_TITLE_PENDING",
          state: "approval-requested",
          approval: { id: "history-proposal-approval" },
        }),
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await page.getByLabel("Switch module").click();
    await page.getByRole("menuitem", { name: "Capture" }).click();
    await openAgentPage(page);
    await openThread(page, "等待确认提案");
    await expect(page.getByTestId("agent-proposal-card")).toContainText("待确认");
    await expect(page.getByTestId("agent-proposal-confirm-button")).toBeVisible();
    await expect(page.getByTestId("agent-proposal-reject-button")).toBeVisible();
  } finally {
    await app.close();
  }
});
