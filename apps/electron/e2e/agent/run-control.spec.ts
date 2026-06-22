import { expect, test } from "@playwright/test";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  sendMessage,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

const SLOW_PROMPT = "请慢慢输出 1 到 200，每个数字单独一行。";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-RUN-001 用户停止正在生成的回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY or OPENAI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await sendMessage(page, SLOW_PROMPT);
    await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("agent-stop-button").click();
    await expect(page.getByTestId("agent-stopped-state")).toContainText("已停止", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("agent-stop-button")).toHaveCount(0);
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-RUN-002 用户停止回复后切换回来仍看到停止状态", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY or OPENAI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await sendMessage(page, SLOW_PROMPT);
    await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("agent-stop-button").click();
    await expect(page.getByTestId("agent-stopped-state")).toBeVisible({ timeout: 30_000 });

    await createNewThread(page);
    await openThread(page, SLOW_PROMPT.slice(0, 20));
    await expect(page.getByTestId("agent-stopped-state")).toContainText("已停止");
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});
