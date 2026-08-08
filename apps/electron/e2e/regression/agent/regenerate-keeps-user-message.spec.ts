import { expect, test } from "@playwright/test";
import {
  hasAi,
  launchAgentPage,
  openThread,
  waitForAssistantReply,
} from "../../acceptance/spec/agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";

const THREAD_TITLE = "REGENERATE_KEEPS_USER_MESSAGE";
const SECOND_QUESTION_ID = "regenerate-user-2";
const SECOND_QUESTION_TEXT = "REGENERATE_SECOND_QUESTION";

type WatchdogRecord = { disappeared: boolean };

test.beforeEach(() => {
  resetAgentFixtures();
  seedAgentThread({
    id: "regenerate-keeps-user-message",
    title: THREAD_TITLE,
    messages: [
      userMessage("regenerate-user-1", "REGENERATE_FIRST_QUESTION"),
      assistantMessage("regenerate-assistant-1", [
        { type: "text", text: "REGENERATE_FIRST_REPLY" },
      ]),
      userMessage(SECOND_QUESTION_ID, SECOND_QUESTION_TEXT),
      assistantMessage("regenerate-assistant-2", [
        { type: "text", text: "REGENERATE_SECOND_REPLY" },
      ]),
    ],
  });
});

test("重新生成回复时本轮用户消息始终保持可见", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, THREAD_TITLE);
    const secondQuestion = page
      .getByTestId("agent-user-message")
      .filter({ hasText: SECOND_QUESTION_TEXT });
    await expect(secondQuestion).toBeVisible();

    // 从点击重新生成开始，到新回复出现为止，按帧采样本轮用户消息节点是否存在。
    // rAF 回调在绘制前执行，因此采样结果等价于用户实际看到的画面；新回复出现后
    // 停止采样，避免长回复滚动把消息行移出虚拟列表造成误报。
    await page.evaluate(
      ({ questionId, originalAssistantId }) => {
        const record: WatchdogRecord = { disappeared: false };
        (
          window as Window & { __regenerateQuestionWatchdog?: WatchdogRecord }
        ).__regenerateQuestionWatchdog = record;
        let previousPresent: boolean | undefined;
        const sample = () => {
          const present = Boolean(
            document.querySelector(`[data-agent-message-id="${questionId}"]`),
          );
          if (previousPresent === true && !present) record.disappeared = true;
          previousPresent = present;
          // 预置对话已有两条 assistant 消息，因此以“最后一条 assistant 不再是
          // 被重新生成的那条”作为新回复出现的判据，随后停止采样。
          const assistantRows = document.querySelectorAll('[data-message-role="assistant"]');
          const lastAssistant = assistantRows[assistantRows.length - 1];
          const nextReplyStarted =
            assistantRows.length >= 2 &&
            lastAssistant?.getAttribute("data-agent-message-id") !== originalAssistantId;
          if (!record.disappeared && !nextReplyStarted) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { questionId: SECOND_QUESTION_ID, originalAssistantId: "regenerate-assistant-2" },
    );

    // 等待重新生成真正开始（running 状态出现停止按钮），此时消失窗口已结束。
    await page.getByTestId("agent-message-row").nth(3).hover();
    await page.getByTestId("agent-regenerate-button").click();
    await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
    await waitForAssistantReply(page);

    const watchdog = await page.evaluate(
      () =>
        (window as Window & { __regenerateQuestionWatchdog?: WatchdogRecord })
          .__regenerateQuestionWatchdog,
    );
    expect(watchdog?.disappeared, "重新生成期间用户消息不应消失").toBe(false);

    await expect(secondQuestion).toBeVisible();
    await expect(page.getByTestId("agent-message-row")).toHaveCount(4);
    await expect(page.getByTestId("agent-message-row").nth(2)).toHaveAttribute(
      "data-message-role",
      "user",
    );
    await expect(page.getByTestId("agent-message-row").nth(3)).toHaveAttribute(
      "data-message-role",
      "assistant",
    );
  } finally {
    await app.close();
  }
});
