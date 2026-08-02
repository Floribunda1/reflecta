import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread } from "../../acceptance/spec/agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";

const THREAD_TITLE = "STREAMING_SCROLL_POSITION_REGRESSION";

test.beforeEach(() => {
  resetAgentFixtures();
  seedAgentThread({
    id: "streaming-scroll-position-regression",
    title: THREAD_TITLE,
    messages: Array.from({ length: 8 }, (_, index) => [
      userMessage(`streaming-scroll-user-${index}`, `USER_${index}`),
      assistantMessage(`streaming-scroll-assistant-${index}`, [
        { type: "text", text: `HISTORY_${index}\n\n`.repeat(index === 7 ? 100 : 20) },
      ]),
    ]).flat(),
  });
});

test("用户离开底部后只有回到底部才恢复自动跟随", async () => {
  const { app, page } = await launchAgentPage();

  try {
    const browserWindow = await app.browserWindow(page);
    await browserWindow.evaluate(
      (window: { unmaximize(): void; setSize(width: number, height: number): void }) => {
        window.unmaximize();
        window.setSize(900, 500);
      },
    );
    await page.evaluate(() => {
      const errors: string[] = [];
      window.addEventListener("error", (event) => errors.push(event.message));
      (window as Window & { __streamingScrollErrors?: string[] }).__streamingScrollErrors = errors;
    });
    await openThread(page, THREAD_TITLE);
    const scroll = page.getByTestId("agent-message-scroll");
    const activeReply = page.locator('[data-index][data-message-role="assistant"]').last();
    await expect
      .poll(
        async () => {
          const replyHeight = await activeReply.evaluate((element) => element.clientHeight);
          const viewportHeight = await scroll.evaluate((element) => element.clientHeight);
          return replyHeight - viewportHeight;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(360);
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    const heightBeforeStickyGrowth = await scroll.evaluate((element) => element.scrollHeight);
    // Trigger the same ResizeObserver path as the next streamed render, without a live model.
    await activeReply.evaluate((element) => {
      (element as HTMLElement).style.paddingBottom = "120px";
    });
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollHeight))
      .toBeGreaterThan(heightBeforeStickyGrowth + 100);
    await expect
      .poll(() =>
        scroll.evaluate(
          (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(1);

    await scroll.hover();
    await page.mouse.wheel(0, -320);
    await expect
      .poll(() =>
        scroll.evaluate(
          (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeGreaterThan(240);
    const afterUp = await scroll.evaluate((element) => element.scrollTop);
    await page.mouse.wheel(0, 80);
    await expect
      .poll(() =>
        scroll.evaluate(
          (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeGreaterThan(120);
    const readingPosition = await scroll.evaluate((element) => element.scrollTop);
    const heightBeforeDownGrowth = await scroll.evaluate((element) => element.scrollHeight);
    expect(readingPosition).toBeGreaterThan(afterUp);
    await activeReply.evaluate((element) => {
      (element as HTMLElement).style.paddingBottom = "360px";
    });
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollHeight))
      .toBeGreaterThan(heightBeforeDownGrowth + 200);
    await page.waitForTimeout(250);
    expect(await scroll.evaluate((element) => element.scrollTop)).toBe(readingPosition);

    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    const heightBeforeResumedGrowth = await scroll.evaluate((element) => element.scrollHeight);
    await activeReply.evaluate((element) => {
      (element as HTMLElement).style.paddingBottom = "480px";
    });
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollHeight))
      .toBeGreaterThan(heightBeforeResumedGrowth + 100);
    await expect
      .poll(() =>
        scroll.evaluate(
          (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __streamingScrollErrors?: string[] }).__streamingScrollErrors ?? [],
      ),
    ).not.toContain("ResizeObserver loop completed with undelivered notifications.");
  } finally {
    await app.close();
  }
});
