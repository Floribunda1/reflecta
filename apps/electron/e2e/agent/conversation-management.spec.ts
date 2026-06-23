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

function localIso(daysAgo: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

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

test("@AG-CONV-004 用户按时间分组查看对话列表", async () => {
  seedAgentThread({
    id: "conv-today-late",
    title: "TODAY_LATE",
    createdAt: localIso(0, 12, 10),
    updatedAt: localIso(0, 12, 10),
  });
  seedAgentThread({
    id: "conv-today-early",
    title: "TODAY_EARLY",
    createdAt: localIso(0, 9, 0),
    updatedAt: localIso(0, 9, 0),
  });
  seedAgentThread({
    id: "conv-yesterday",
    title: "YESTERDAY_THREAD",
    createdAt: localIso(1, 12, 0),
    updatedAt: localIso(1, 12, 0),
  });
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-thread-group").filter({ hasText: "今天" })).toBeVisible();
    await expect(page.getByTestId("agent-thread-group").filter({ hasText: "昨天" })).toBeVisible();

    const sidebarText = await page.getByTestId("agent-thread-sidebar").innerText();
    expect(sidebarText.indexOf("TODAY_LATE")).toBeLessThan(sidebarText.indexOf("TODAY_EARLY"));
    expect(sidebarText.indexOf("TODAY_EARLY")).toBeLessThan(
      sidebarText.indexOf("YESTERDAY_THREAD"),
    );
  } finally {
    await app.close();
  }
});

test("@AG-CONV-005 用户 Fork 当前对话分支后继续查看同一段内容", async () => {
  seedCompletedThread({
    id: "conv-fork-source",
    title: "FORK_SOURCE",
    userText: "FORK_USER_MESSAGE",
    assistantText: "FORK_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await threadByTitle(page, "FORK_SOURCE").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Fork 当前分支" }).click();

    await expect(page.getByRole("button", { name: "FORK_SOURCE", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "FORK_SOURCE 副本", exact: true })).toBeVisible();
    await expect(page.getByTestId("agent-user-message")).toContainText("FORK_USER_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("FORK_AGENT_REPLY");
  } finally {
    await app.close();
  }
});
