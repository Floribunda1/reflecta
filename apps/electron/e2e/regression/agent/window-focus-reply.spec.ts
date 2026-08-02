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

    await window.evaluate((browserWindow: { focus(): void }) => browserWindow.focus());
    await expect
      .poll(() =>
        window.evaluate((browserWindow: { isFocused(): boolean }) => browserWindow.isFocused()),
      )
      .toBe(true);
    await expect(
      page.locator('[data-testid="agent-message-row"][data-message-role="assistant"]'),
    ).toHaveCount(1);

    const stopButton = page.getByTestId("agent-stop-button");
    if (await stopButton.isVisible()) await stopButton.click();
  } finally {
    await app.close();
  }
});
