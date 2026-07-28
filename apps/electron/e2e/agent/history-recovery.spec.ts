import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread, threadByTitle } from "./agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedCompletedThread,
  seedUnderstandingIdByTitle,
  userMessage,
} from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
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

test("@AG-HISTORY-006 用户重启应用后仍可打开 Agent 回复中的知识库引用", async () => {
  const understandingId = seedUnderstandingIdByTitle("React Server Components");
  seedAgentThread({
    id: "history-entity-ref",
    title: "历史知识库引用",
    entityCatalog: [
      {
        entity: {
          type: "understanding",
          id: understandingId,
          title: "React Server Components",
        },
        origin: {
          kind: "tool_result",
          toolCallId: "history-entity-ref-tool",
          toolName: "retrieve_knowledge",
        },
      },
    ],
    messages: [
      userMessage("history-entity-ref-user", "展示历史知识库引用"),
      assistantMessage("history-entity-ref-assistant", [
        {
          type: "text",
          text: `## 相关资料\n\n### 1. [[u:${understandingId}]]\n\n- **重点**：可以继续查看 [[u:${understandingId}]]。`,
        },
      ]),
    ],
  });

  const first = await launchAgentPage();
  await first.app.close();

  const { app, page } = await launchAgentPage();
  try {
    await openThread(page, "历史知识库引用");

    await expect(page.locator("h2", { hasText: "相关资料" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "React Server Components" })).toBeVisible();
    await expect(page.locator('[data-streamdown="strong"]', { hasText: "重点" })).toBeVisible();
    const wikiLink = page
      .locator('[data-slot="wiki-link"]')
      .filter({
        hasText: "React Server Components",
      })
      .first();
    await expect(wikiLink).toBeVisible();
    await wikiLink.click();
    await expect(page.getByTestId("agent-context-inspector")).toBeVisible();
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
      { timeout: 15_000 },
    );
  } finally {
    await app.close();
  }
});
