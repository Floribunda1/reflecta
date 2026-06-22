import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { readE2eTestEnv } from "../test-env";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  sendMessage,
  threadByTitle,
  waitForAssistantReply,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
  fs.rmSync(path.join(readE2eTestEnv().contentStorageRoot, "Sessions"), {
    recursive: true,
    force: true,
  });
});

test("@AG-PI-START-001 用户在 Pi-backed session 中发送第一条消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(page, "hello");
    await expect(
      page.getByTestId("agent-stop-button").or(page.getByTestId("agent-assistant-text").last()),
    ).toBeVisible({ timeout: 15_000 });
    await waitForAssistantReply(page);
    await expect(page.getByTestId("agent-thread-item").filter({ hasText: "hello" })).toBeVisible();
    await expect(composer(page)).toBeEditable();

    const sessionsRoot = path.join(readE2eTestEnv().contentStorageRoot, "Sessions");
    const sessionFiles = fs.existsSync(sessionsRoot)
      ? fs.readdirSync(sessionsRoot).filter((name) => name.endsWith(".jsonl"))
      : [];
    expect(sessionFiles.length).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});

test("@AG-PI-HISTORY-001 用户重启后恢复 Pi-backed session 历史", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const first = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(first.page);
    await sendMessage(first.page, "hello");
    await waitForAssistantReply(first.page);
  } finally {
    await first.app.close();
  }

  const second = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await expect(threadByTitle(second.page, "hello")).toBeVisible();
    await openThread(second.page, "hello");
    await expect(
      second.page.getByTestId("agent-user-message").filter({ hasText: "hello" }),
    ).toBeVisible();
    await expect(second.page.getByTestId("agent-assistant-text").last()).toBeVisible();
    await expect(composer(second.page)).toBeEditable();
  } finally {
    await second.app.close();
  }
});
