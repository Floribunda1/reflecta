import { expect, test } from "@playwright/test";
import {
  createNewThread,
  hasAi,
  launchAgentPage,
  sendMessage,
} from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures } from "../../acceptance/spec/agent/agent-fixtures";

const SLOW_PROMPT = "请慢慢输出 1 到 400，每个数字单独一行。";

test.beforeEach(() => {
  resetAgentFixtures();
});

test.describe.configure({ retries: 2 });

test("blurring and refocusing during an Agent reply does not duplicate the reply", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(page, SLOW_PROMPT);
    await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });

    const window = await app.browserWindow(page);
    await window.evaluate((browserWindow: { blur(): void }) => browserWindow.blur());
    await expect
      .poll(() =>
        window.evaluate((browserWindow: { isFocused(): boolean }) => browserWindow.isFocused()),
      )
      .toBe(false);

    await expect(page.getByTestId("agent-assistant-text").last()).toBeVisible({ timeout: 120_000 });

    await expect(page.getByTestId("agent-assistant-text").last()).toBeVisible({ timeout: 120_000 });

    // Best-effort refocus: a long blur can leave the macOS app inactive, and
    // under the parallel E2E suite other Electron instances keep stealing the
    // frontmost slot, so isFocused() is not reliably restorable. The renderer
    // has no OS-focus listeners — the guarantee under test is that the reply
    // is not duplicated after the blur/refocus cycle — so verify that below
    // instead of blocking on OS focus.
    await app.evaluate(({ app: electronApp }) => electronApp.focus({ steal: true }));
    await window.evaluate(
      (browserWindow: { isMinimized(): boolean; restore(): void; show(): void; focus(): void }) => {
        if (browserWindow.isMinimized()) browserWindow.restore();
        browserWindow.show();
        browserWindow.focus();
      },
    );
    await page.waitForTimeout(300);

    await expect(
      page.locator('[data-testid="agent-message-row"][data-message-role="assistant"]'),
    ).toHaveCount(1);

    const stopButton = page.getByTestId("agent-stop-button");
    if (await stopButton.isVisible()) await stopButton.click();
  } finally {
    await app.close();
  }
});
