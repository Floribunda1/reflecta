import { expect, test } from "@playwright/test";
import { composer, launchAgentPage, openThread } from "./agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
  seedAgentThread({
    id: "conversation-search",
    title: "对话内搜索",
    messages: [
      userMessage("find-user", "用户消息中的 FIND_QUERY"),
      assistantMessage("find-assistant", [
        { type: "text", text: "Agent 回复第一次出现 FIND_QUERY，稍后再次出现 FIND_QUERY。" },
      ]),
    ],
  });
});

async function searchConversation(page: Awaited<ReturnType<typeof launchAgentPage>>["page"]) {
  await openThread(page, "对话内搜索");
  await page.keyboard.press("Meta+f");
  await page.getByTestId("agent-thread-find-input").fill("FIND_QUERY");
  await expect(page.getByTestId("agent-thread-find-box")).toContainText("1/3");
}

test("@AG-FIND-001 用户搜索当前对话并打开第一个匹配项", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await searchConversation(page);
    const matches = page.locator('[data-chat-find-match="true"]');
    await expect(matches).toHaveCount(3);
    await expect(page.locator('[data-chat-find-active="true"]')).toHaveCount(1);
    await expect(page.locator('[data-chat-find-active="true"]')).toHaveText("FIND_QUERY");
  } finally {
    await app.close();
  }
});

test("@AG-FIND-002 用户在多个匹配项之间移动并关闭搜索", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await searchConversation(page);
    await page.getByRole("button", { name: "下一个匹配项" }).click();
    await expect(page.getByTestId("agent-thread-find-box")).toContainText("2/3");

    await page.getByRole("button", { name: "关闭搜索" }).click();
    await expect(page.getByTestId("agent-thread-find-box")).toHaveCount(0);
    await expect(page.locator('[data-chat-find-match="true"]')).toHaveCount(0);
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-FIND-003 用户搜索当前对话中没有出现的内容", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "对话内搜索");
    await page.keyboard.press("Meta+f");
    await page.getByTestId("agent-thread-find-input").fill("NO_MATCH_QUERY");

    await expect(page.getByTestId("agent-thread-find-box")).toContainText("0/0");
    await expect(page.getByRole("button", { name: "上一个匹配项" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "下一个匹配项" })).toBeDisabled();
    await page.getByRole("button", { name: "关闭搜索" }).click();
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});
