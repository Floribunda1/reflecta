import { expect, test } from "@playwright/test";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  sendMessage,
  threadByTitle,
  waitForAssistantReply,
} from "./agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedCompletedThread,
  toolPart,
  userMessage,
} from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-CONV-001 对话 A 正在回复时切换到对话 B 不影响 B", async () => {
  seedAgentThread({
    id: "conv-a",
    title: "对话 A",
    messages: [
      userMessage("conv-a-user", "A_USER_MESSAGE"),
      assistantMessage("conv-a-assistant", [toolPart("search_all", "conv-a-tool", {})]),
    ],
  });
  seedCompletedThread({
    id: "conv-b",
    title: "对话 B",
    userText: "B_USER_MESSAGE",
    assistantText: "B_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "对话 B");
    await expect(page.getByTestId("agent-user-message")).toContainText("B_USER_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("B_AGENT_REPLY");
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-CONV-002 对话 A 回复完成后切回 A 可以看到 A 的内容", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  seedCompletedThread({
    id: "conv-b",
    title: "对话 B",
    userText: "B_USER_MESSAGE",
    assistantText: "B_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await sendMessage(page, "start A");
    await openThread(page, "对话 B");
    await expect(page.getByTestId("agent-user-message")).toContainText("B_USER_MESSAGE");
    await openThread(page, "start A");
    await waitForAssistantReply(page);
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

test("@AG-CONV-003 用户删除一个对话后仍可查看剩余对话", async () => {
  seedCompletedThread({
    id: "conv-a",
    title: "对话 A",
    userText: "A_USER_MESSAGE",
    assistantText: "A_AGENT_REPLY",
  });
  seedCompletedThread({
    id: "conv-b",
    title: "对话 B",
    userText: "B_USER_MESSAGE",
    assistantText: "B_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await threadByTitle(page, "对话 A").click({ button: "right" });
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByRole("button", { name: "删除" }).click();

    await expect(threadByTitle(page, "对话 A")).toHaveCount(0);
    await expect(threadByTitle(page, "对话 B")).toBeVisible();
    await openThread(page, "对话 B");
    await expect(page.getByTestId("agent-user-message")).toContainText("B_USER_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("B_AGENT_REPLY");
  } finally {
    await app.close();
  }
});
