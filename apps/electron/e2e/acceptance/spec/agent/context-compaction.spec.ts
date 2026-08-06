import { expect, test } from "@playwright/test";
import {
  composer,
  hasAi,
  launchAgentPage,
  openThread,
  sendMessage,
  waitForAssistantReply,
} from "./agent-e2e";
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

// 自动压缩判定（pi agent-session）取最后一次 assistant 消息的 usage：
// shouldCompact(contextTokens, contextWindow) = contextTokens > contextWindow - reserveTokens(16384)。
// 默认模型 deepseek-v4-flash 窗口 1M，因此 usage 超过 ~984K 才会触发 pre-prompt 阈值压缩。
// 这里用 990_000 模拟"已接近上下文上限"的会话，让压缩在真实模型调用之前发生；
// 若换更大窗口模型，需同步调大该值。
const COMPACTION_TRIGGER_USAGE_TOKENS = 990_000;

test("@AG-COMPACT-001 过长对话在继续回复前自动压缩上下文", async () => {
  expect(hasAi).toBe(true);
  test.setTimeout(180_000);
  const messages = Array.from({ length: 8 }, (_, index) => [
    userMessage(`automatic-user-${index}`, `第 ${index + 1} 轮背景：${"重要约束。".repeat(1_600)}`),
    assistantMessage(
      `automatic-assistant-${index}`,
      [{ type: "text", text: `第 ${index + 1} 轮记录：${"已经理解。".repeat(1_600)}` }],
      COMPACTION_TRIGGER_USAGE_TOKENS,
    ),
  ]).flat();
  seedAgentThread({
    id: "automatic-compaction",
    title: "自动压缩长对话",
    includeRuntimeMessages: true,
    messages,
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "自动压缩长对话");
    await sendMessage(page, "请继续回答");
    await expect(page.getByTestId("agent-context-compaction-progress")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("agent-context-compaction-receipt")).toBeVisible({
      timeout: 120_000,
    });
    await waitForAssistantReply(page);
  } finally {
    await app.close();
  }
});

test("@AG-COMPACT-002 用户手动压缩当前对话上下文", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const messages = Array.from({ length: 8 }, (_, index) => [
    userMessage(`manual-user-${index}`, `第 ${index + 1} 轮约束：${"重要背景。".repeat(1_600)}`),
    assistantMessage(`manual-assistant-${index}`, [
      { type: "text", text: `第 ${index + 1} 轮确认：${"已记录。".repeat(1_600)}` },
    ]),
  ]).flat();
  seedAgentThread({
    id: "manual-compaction",
    title: "手动压缩长对话",
    includeRuntimeMessages: true,
    messages,
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "手动压缩长对话");
    await page.getByTestId("agent-thread-actions-button").click();
    await page.getByTestId("agent-compact-context-menu-item").click();

    await expect(page.getByTestId("agent-context-compaction-progress")).toBeVisible();
    await expect(page.getByRole("button", { name: "正在压缩上下文" })).toBeDisabled();
    await page.getByTestId("agent-thread-actions-button").click();
    await expect(page.getByTestId("agent-compact-context-menu-item")).toBeDisabled();

    await expect(page.getByTestId("agent-context-compaction-progress")).toBeHidden({
      timeout: 120_000,
    });
    await expect(page.getByTestId("agent-context-compaction-receipt")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-COMPACT-003 用户检查压缩后的上下文检查点", async () => {
  seedCompactedThread();
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "上下文压缩回执");
    await expect(page.getByTestId("agent-user-message")).toContainText("ORIGINAL_CONTEXT_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("ORIGINAL_CONTEXT_REPLY");

    const receipt = page.getByTestId("agent-context-compaction-receipt");
    await expect(receipt).toContainText("已压缩较早的对话上下文");
    await expect(page.getByTestId("agent-context-compaction-summary")).toBeHidden();
    await receipt.getByTestId("agent-context-compaction-trigger").click();
    await expect(page.getByTestId("agent-context-compaction-summary")).toContainText(
      "继续验证压缩后的上下文",
    );

    await page.getByTestId("agent-thread-actions-button").click();
    await expect(page.getByTestId("agent-compact-context-menu-item")).toBeEnabled();
  } finally {
    await app.close();
  }
});

test("@AG-COMPACT-004 用户重启应用后仍能检查压缩回执", async () => {
  seedCompactedThread();
  const first = await launchAgentPage();
  await first.app.close();

  const { app, page } = await launchAgentPage();
  try {
    await openThread(page, "上下文压缩回执");
    const receipt = page.getByTestId("agent-context-compaction-receipt");
    await expect(receipt).toBeVisible();
    await receipt.getByTestId("agent-context-compaction-trigger").click();
    await expect(page.getByTestId("agent-context-compaction-summary")).toContainText(
      "保留原始消息",
    );
  } finally {
    await app.close();
  }
});

test("@AG-COMPACT-005 当前对话过短时用户得到清晰反馈", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  seedAgentThread({
    id: "short-compaction",
    title: "较短对话",
    includeRuntimeMessages: true,
    messages: [
      userMessage("short-user", "简短问题"),
      assistantMessage("short-assistant", [{ type: "text", text: "简短回复" }]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "较短对话");
    await page.getByTestId("agent-thread-actions-button").click();
    await page.getByTestId("agent-compact-context-menu-item").click();

    await expect(page.getByTestId("agent-context-compaction-error")).toContainText(
      "当前对话还不需要压缩",
    );
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});
