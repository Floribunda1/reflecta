import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread } from "./agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

function seedCompactedThread() {
  seedAgentThread({
    id: "context-compaction",
    title: "上下文压缩回执",
    messages: [
      userMessage("compaction-user", "ORIGINAL_CONTEXT_MESSAGE"),
      assistantMessage("compaction-assistant", [{ type: "text", text: "ORIGINAL_CONTEXT_REPLY" }]),
    ],
    contextCompactions: [
      {
        summary: "## 当前意图\n继续验证压缩后的上下文\n\n## 用户陈述与约束\n保留原始消息",
        afterMessageId: "compaction-assistant",
        tokensBefore: 120_000,
        estimatedTokensAfter: 18_000,
      },
    ],
  });
}

test("@AG-COMPACT-003 用户可以检查压缩回执且原消息保持可见", async () => {
  seedCompactedThread();
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "上下文压缩回执");
    await expect(page.getByTestId("agent-user-message")).toContainText("ORIGINAL_CONTEXT_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("ORIGINAL_CONTEXT_REPLY");

    const receipt = page.getByTestId("agent-context-compaction-receipt");
    await expect(receipt).toContainText("已压缩较早的对话上下文");
    await expect(page.getByTestId("agent-context-compaction-summary")).toBeHidden();
    await receipt.locator("summary").click();
    await expect(page.getByTestId("agent-context-compaction-summary")).toContainText(
      "继续验证压缩后的上下文",
    );

    await page.getByTestId("agent-thread-actions-button").click();
    await expect(page.getByTestId("agent-compact-context-menu-item")).toBeEnabled();
  } finally {
    await app.close();
  }
});

test("@AG-COMPACT-004 用户重启应用后压缩回执仍然存在", async () => {
  seedCompactedThread();
  const first = await launchAgentPage();
  await first.app.close();

  const { app, page } = await launchAgentPage();
  try {
    await openThread(page, "上下文压缩回执");
    const receipt = page.getByTestId("agent-context-compaction-receipt");
    await expect(receipt).toBeVisible();
    await receipt.locator("summary").click();
    await expect(page.getByTestId("agent-context-compaction-summary")).toContainText(
      "保留原始消息",
    );
  } finally {
    await app.close();
  }
});
