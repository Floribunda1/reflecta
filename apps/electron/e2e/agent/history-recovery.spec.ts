import { expect, test } from "@playwright/test";
import { composer, launchAgentPage, openAgentPage, openThread, threadByTitle } from "./agent-e2e";
import {
  assistantMessage,
  proposalPart,
  resetAgentFixtures,
  seedAgentThread,
  seedCompletedThread,
  seedUnderstandingIdByTitle,
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
      userMessage("history-proposal-user", "请创建一个 Understanding"),
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

test("@AG-HISTORY-006 用户重启应用后仍可打开 Agent 回复中的知识库引用", async () => {
  const understandingId = seedUnderstandingIdByTitle("React Server Components");
  seedAgentThread({
    id: "history-entity-ref",
    title: "历史知识库引用",
    entitySources: [
      {
        sourceId: "S1",
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
        { type: "text", text: "可以继续查看 [[ref:S1]]。" },
      ]),
    ],
  });

  const first = await launchAgentPage();
  await first.app.close();

  const { app, page } = await launchAgentPage();
  try {
    await openThread(page, "历史知识库引用");
    await expect(page.getByText("[[ref:S1]]")).toHaveCount(0);

    const wikiLink = page.locator('[data-slot="wiki-link"]').filter({
      hasText: "React Server Components",
    });
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
