import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { getE2eAiEnv, readE2eTestEnv, writeE2eAiConfig } from "../test-env";
import {
  composer,
  configureE2eAiKey,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  selectContext,
  sendMessage,
  threadByTitle,
  waitForAssistantReply,
  writeAttachmentFile,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

const SLOW_PROMPT = "请慢慢输出 1 到 400，每个数字单独一行。";
const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";

function sessionsRoot() {
  return path.join(readE2eTestEnv().contentStorageRoot, "Sessions");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPiEventTypes() {
  const root = sessionsRoot();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(root, name), "utf-8")
        .split(/\r?\n/)
        .flatMap((line) => {
          if (!line.trim()) return [];
          const entry: unknown = JSON.parse(line);
          if (
            !isRecord(entry) ||
            entry.type !== "custom" ||
            entry.customType !== REFLECTA_AGENT_EVENT_ENTRY ||
            !isRecord(entry.data) ||
            typeof entry.data.type !== "string"
          ) {
            return [];
          }
          return [entry.data.type];
        }),
    );
}

test.beforeEach(() => {
  resetAgentFixtures();
  fs.rmSync(sessionsRoot(), { recursive: true, force: true });
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

test("@AG-PI-FAILURE-001 回复失败后用户可以继续发送消息", async () => {
  const apiKey = getE2eAiEnv().apiKey;
  test.skip(!apiKey, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  writeE2eAiConfig({ ...process.env, REFLECTA_E2E_AI_API_KEY: "invalid-reflecta-e2e-key" });
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await sendMessage(page, "first");
    await expect(page.getByTestId("agent-error-banner")).toContainText("回复失败", {
      timeout: 60_000,
    });
    await expect(composer(page)).toBeEditable();
    expect(readPiEventTypes()).toContain("run.failed");

    await configureE2eAiKey(page, apiKey);
    await sendMessage(page, "second");
    await waitForAssistantReply(page);

    await expect(page.getByTestId("agent-user-message").filter({ hasText: "first" })).toBeVisible();
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "second" }),
    ).toBeVisible();
    await expect(composer(page)).toBeEditable();
    expect(readPiEventTypes()).toContain("run.completed");
  } finally {
    await app.close();
    writeE2eAiConfig({ ...process.env, REFLECTA_E2E_AI_API_KEY: apiKey });
  }
});

test("@AG-PI-RUN-001 用户停止 Pi-backed session 中正在生成的回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

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
    expect(readPiEventTypes()).toContain("run.cancelled");
  } finally {
    await app.close();
  }
});

test("@AG-PI-RUN-002 用户停止回复后切换回来仍看到停止状态", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

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

test("@AG-PI-CONTEXT-001 用户在 Pi-backed session 中选择引用后发送消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await selectContext(page, "React", "React Server Components", "thought");
    await selectContext(page, "React", "React", "category");
    await composer(page).click();
    await page.keyboard.type("请比较这两个引用");
    await page.getByTestId("agent-send-button").click();
    await expect(page.getByTestId("agent-user-message")).toContainText("React Server Components");
    await expect(page.getByTestId("agent-user-message")).toContainText("React");
    await waitForAssistantReply(page);
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-PI-ATTACHMENT-001 用户在 Pi-backed session 中发送附件后重启仍能看到附件", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const filePath = writeAttachmentFile("PI_ATTACHMENT_FILE.txt");
  const fileName = path.basename(filePath);
  const first = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(first.page);
    const fileChooser = first.page.waitForEvent("filechooser");
    await first.page.getByTestId("agent-attachment-button").click();
    await (await fileChooser).setFiles(filePath);
    await expect(first.page.getByTestId("agent-attachment-preview")).toContainText(fileName);
    await sendMessage(first.page, "请总结这个附件");
    await expect(first.page.getByTestId("agent-message-attachment")).toContainText(fileName);
    await waitForAssistantReply(first.page);
  } finally {
    await first.app.close();
  }

  const second = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await expect(threadByTitle(second.page, "请总结这个附件")).toBeVisible();
    await openThread(second.page, "请总结这个附件");
    await expect(second.page.getByTestId("agent-message-attachment")).toContainText(fileName);
    await expect(composer(second.page)).toBeEditable();
  } finally {
    await second.app.close();
  }
});

test("@AG-PI-MODEL-001 用户在 Pi-backed session 中选择模型和推理强度后发送消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await page.getByTestId("agent-model-menu-button").click();
    const firstModel = page.getByTestId("agent-model-option").first();
    const modelName = (await firstModel.locator("span").first().innerText()).trim();
    await firstModel.click();

    await page.getByTestId("agent-model-menu-button").click();
    await page
      .locator('[data-testid="agent-reasoning-option"][data-reasoning-level="medium"]')
      .click();
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("agent-model-menu-button")).toContainText(modelName);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
    await sendMessage(page, "请用一句话回复 model selection e2e");
    await expect(page.getByTestId("agent-model-menu-button")).toContainText(modelName);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
    await waitForAssistantReply(page);
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
