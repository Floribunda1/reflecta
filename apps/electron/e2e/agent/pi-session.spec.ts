import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
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
import { categoryExistsByName, resetAgentFixtures, thoughtExistsByTitle } from "./agent-fixtures";

const SLOW_PROMPT = "请慢慢输出 1 到 400，每个数字单独一行。";
const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";
const PI_REJECT_PROPOSAL_TITLE = "PI_REJECT_CANDIDATE_THOUGHT";
const PI_APPROVE_PROPOSAL_TITLE = "PI_APPROVE_CANDIDATE_THOUGHT";
const PI_RELOAD_PROPOSAL_TITLE = "PI_RELOAD_CANDIDATE_THOUGHT";
const PI_CATEGORY_PROPOSAL_NAME = "PI_APPROVE_CANDIDATE_CATEGORY";
const ABANDONED_RUN_MESSAGE = "ABANDONED_RUN_MESSAGE";

function sessionsRoot() {
  return path.join(readE2eTestEnv().contentStorageRoot, "Sessions");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPiEventTypes() {
  return readPiEvents()
    .map((event) => event.type)
    .filter((type): type is string => Boolean(type));
}

function readPiEvents() {
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
          return [entry.data];
        }),
    );
}

function flushPiSession(manager: SessionManager) {
  const sessionFile = manager.getSessionFile();
  if (!sessionFile) return;
  const flushable = manager as unknown as { _rewriteFile?: () => void; flushed?: boolean };
  if (typeof flushable._rewriteFile !== "function") throw new Error("Pi session flush unavailable");
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  flushable._rewriteFile();
  flushable.flushed = true;
}

function seedAbandonedPiSession() {
  const root = readE2eTestEnv().contentStorageRoot;
  fs.mkdirSync(sessionsRoot(), { recursive: true });
  const manager = SessionManager.create(root, sessionsRoot());
  const sessionId = manager.getSessionId();
  const base = {
    sessionId,
    runId: "run_abandoned",
    createdAt: "2026-06-23T00:00:00.000Z",
  };
  for (const event of [
    { ...base, id: "evt_abandoned_1", type: "run.started" },
    {
      ...base,
      id: "evt_abandoned_2",
      type: "user.message",
      messageId: "user_abandoned",
      text: ABANDONED_RUN_MESSAGE,
    },
    {
      ...base,
      id: "evt_abandoned_3",
      type: "assistant.reasoning.delta",
      messageId: "assistant_abandoned",
      delta: "正在思考",
    },
  ]) {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
  }
  manager.appendSessionInfo(ABANDONED_RUN_MESSAGE);
  flushPiSession(manager);
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

test("@AG-PI-RUN-003 用户重新打开有未完成回复的 Pi session 后不会卡在正在回复", async () => {
  seedAbandonedPiSession();
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await openThread(page, ABANDONED_RUN_MESSAGE);
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: ABANDONED_RUN_MESSAGE }),
    ).toBeVisible();
    await expect(page.getByTestId("agent-stopped-state")).toContainText("已停止");
    await expect(page.getByTestId("agent-stop-button")).toHaveCount(0);
    await expect(composer(page)).toBeEditable();
    expect(readPiEventTypes()).toContain("run.cancelled");
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

test("@AG-PI-TOOL-READ-001 用户在 Pi-backed session 中使用只读知识库工具", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      "请必须使用知识库搜索工具 search_all 查找 React Server Components，并简短总结你找到的内容。",
    );
    await expect(page.getByTestId("agent-tool-activity")).toBeVisible({ timeout: 120_000 });
    await waitForAssistantReply(page);
    await page.getByTestId("agent-tool-activity").first().click();
    await expect(page.getByText("搜索相关内容").first()).toBeVisible();

    const eventTypes = readPiEventTypes();
    expect(eventTypes).toContain("tool.started");
    expect(eventTypes).toContain("tool.completed");
    expect(eventTypes).not.toContain("approval.requested");
    expect(readPiEvents().some((event) => event.toolName === "search_all")).toBe(true);
  } finally {
    await app.close();
  }
});

test("@AG-PI-PROPOSAL-REJECT-001 用户拒绝 Pi-backed session 中的候选 Thought", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须调用 thought_create 工具提出候选 Thought。标题必须是 ${PI_REJECT_PROPOSAL_TITLE}，正文写一行中文。等待我确认，不要直接写入。`,
    );
    const card = page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: PI_REJECT_PROPOSAL_TITLE });
    await expect(card).toBeVisible({ timeout: 120_000 });
    await card.getByTestId("agent-proposal-reject-button").click();
    await expect(card).toContainText("已拒绝", { timeout: 120_000 });
    await expect(card).toContainText("未写入知识库");

    expect(thoughtExistsByTitle(PI_REJECT_PROPOSAL_TITLE)).toBe(false);
    const eventTypes = readPiEventTypes();
    expect(eventTypes).toContain("approval.requested");
    expect(eventTypes).toContain("approval.resolved");
  } finally {
    await app.close();
  }
});

test("@AG-PI-PROPOSAL-APPROVE-001 用户确认 Pi-backed session 中的候选 Thought", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须调用 thought_create 工具提出候选 Thought。标题必须是 ${PI_APPROVE_PROPOSAL_TITLE}，正文写一行中文。等待我确认，不要直接写入。`,
    );
    const card = page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: PI_APPROVE_PROPOSAL_TITLE });
    await expect(card).toBeVisible({ timeout: 120_000 });
    await card.getByTestId("agent-proposal-confirm-button").click();
    await expect(card).toContainText("已确认", { timeout: 120_000 });
    await expect(card).toContainText("已写入");

    expect(thoughtExistsByTitle(PI_APPROVE_PROPOSAL_TITLE)).toBe(true);
    const eventTypes = readPiEventTypes();
    expect(eventTypes).toContain("approval.requested");
    expect(eventTypes).toContain("approval.resolved");
    expect(eventTypes).toContain("tool.completed");
  } finally {
    await app.close();
  }
});

test("@AG-PI-PROPOSAL-CATEGORY-001 用户确认 Pi-backed session 中的候选 Category", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须调用 category_create 工具提出候选 Category。名称必须是 ${PI_CATEGORY_PROPOSAL_NAME}。等待我确认，不要直接写入。`,
    );
    const card = page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: PI_CATEGORY_PROPOSAL_NAME });
    await expect(card).toBeVisible({ timeout: 120_000 });
    await card.getByTestId("agent-proposal-confirm-button").click();
    await expect(card).toContainText("已确认", { timeout: 120_000 });
    await expect(card).toContainText("已写入");

    expect(categoryExistsByName(PI_CATEGORY_PROPOSAL_NAME)).toBe(true);
    const events = readPiEvents();
    expect(
      events.some(
        (event) => event.type === "approval.requested" && event.toolName === "category_create",
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) => event.type === "tool.completed" && event.toolName === "category_create",
      ),
    ).toBe(true);
  } finally {
    await app.close();
  }
});

test("@AG-PI-PROPOSAL-RELOAD-001 用户重启后仍能处理等待确认的候选 Thought", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(300_000);

  const prompt = `创建待确认 Thought：请必须调用 thought_create 工具提出候选 Thought。标题必须是 ${PI_RELOAD_PROPOSAL_TITLE}，正文写一行中文。等待我确认，不要直接写入。`;
  const first = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(first.page);
    await sendMessage(first.page, prompt);
    await expect(
      first.page.getByTestId("agent-proposal-card").filter({ hasText: PI_RELOAD_PROPOSAL_TITLE }),
    ).toBeVisible({ timeout: 120_000 });
  } finally {
    await first.app.close();
  }

  const second = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await openThread(second.page, prompt.slice(0, 20));
    const card = second.page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: PI_RELOAD_PROPOSAL_TITLE });
    await expect(card).toBeVisible();
    await card.getByTestId("agent-proposal-reject-button").click();
    await expect(card).toContainText("已拒绝", { timeout: 120_000 });
    expect(thoughtExistsByTitle(PI_RELOAD_PROPOSAL_TITLE)).toBe(false);
  } finally {
    await second.app.close();
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
