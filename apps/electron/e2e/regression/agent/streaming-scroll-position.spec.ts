import { expect, test } from "@playwright/test";
import {
  hasAi,
  launchAgentPage,
  openThread,
  sendMessage,
} from "../../acceptance/spec/agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";

const THREAD_TITLE = "STREAMING_SCROLL_POSITION_REGRESSION";
const SLOW_PROMPT = "请慢慢输出 1 到 2000，每个数字单独一行。";

test.beforeEach(() => {
  resetAgentFixtures();
  seedAgentThread({
    id: "streaming-scroll-position-regression",
    title: THREAD_TITLE,
    messages: Array.from({ length: 8 }, (_, index) => [
      userMessage(`streaming-scroll-user-${index}`, `USER_${index}`),
      assistantMessage(`streaming-scroll-assistant-${index}`, [
        { type: "text", text: `HISTORY_${index}\n\n`.repeat(20) },
      ]),
    ]).flat(),
  });
});

test("streaming does not resume auto-scroll after the user scrolls down slightly", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    const browserWindow = await app.browserWindow(page);
    await browserWindow.evaluate(
      (window: { unmaximize(): void; setSize(width: number, height: number): void }) => {
        window.unmaximize();
        window.setSize(900, 500);
      },
    );
    await openThread(page, THREAD_TITLE);
    await sendMessage(page, SLOW_PROMPT);
    const scroll = page.getByTestId("agent-message-scroll");
    const activeReply = page.locator('[data-index][data-message-role="assistant"]').last();
    await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(
        async () => {
          const replyHeight = await activeReply.evaluate((element) => element.clientHeight);
          const viewportHeight = await scroll.evaluate((element) => element.clientHeight);
          return replyHeight - viewportHeight;
        },
        { timeout: 120_000 },
      )
      .toBeGreaterThan(80);

    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await scroll.hover();
    await page.mouse.wheel(0, -48);
    await expect
      .poll(() =>
        scroll.evaluate(
          (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeGreaterThan(32);
    const afterUp = await scroll.evaluate((element) => element.scrollTop);
    const heightBeforeUpGrowth = await scroll.evaluate((element) => element.scrollHeight);
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollHeight), { timeout: 120_000 })
      .toBeGreaterThan(heightBeforeUpGrowth + 24);
    await page.waitForTimeout(250);
    expect(await scroll.evaluate((element) => element.scrollTop)).toBe(afterUp);

    await page.mouse.wheel(0, 120);
    await expect
      .poll(() =>
        scroll.evaluate(
          (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(1);
    const readingPosition = await scroll.evaluate((element) => element.scrollTop);
    const heightBeforeDownGrowth = await scroll.evaluate((element) => element.scrollHeight);
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollHeight), { timeout: 120_000 })
      .toBeGreaterThan(heightBeforeDownGrowth + 24);
    await page.waitForTimeout(250);
    expect(await scroll.evaluate((element) => element.scrollTop)).toBe(readingPosition);
  } finally {
    const stopButton = page.getByTestId("agent-stop-button");
    if (await stopButton.isVisible().catch(() => false)) await stopButton.click();
    await app.close();
  }
});
