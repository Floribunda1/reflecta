import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getE2eAiEnv, readE2eTestEnv, writeE2eAiConfig } from "../test-env";
import {
  composer,
  configureE2eAiKey,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  PDF_ATTACHMENT_PHRASE,
  selectContext,
  sendMessage,
  threadByTitle,
  waitForAssistantReply,
  writeAttachmentFile,
  writePdfAttachmentFile,
} from "./agent-e2e";
import {
  assistantMessage,
  domainExistsByName,
  proposalPart,
  resetAgentFixtures,
  seedAgentThread,
  understandingExistsByTitle,
  userMessage,
} from "./agent-fixtures";

const SLOW_PROMPT = "请慢慢输出 1 到 400，每个数字单独一行。";
const STREAM_SWITCH_OTHER_THREAD = "STREAM_SWITCH_OTHER_THREAD";
const STREAM_SWITCH_OTHER_REPLY = "STREAM_SWITCH_OTHER_REPLY";
const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";
const PI_REJECT_PROPOSAL_TITLE = "PI_REJECT_CANDIDATE_UNDERSTANDING";
const PI_APPROVE_PROPOSAL_TITLE = "PI_APPROVE_CANDIDATE_UNDERSTANDING";
const PI_RELOAD_PROPOSAL_TITLE = "PI_RELOAD_CANDIDATE_UNDERSTANDING";
const PI_DOMAIN_PROPOSAL_NAME = "PI_APPROVE_CANDIDATE_DOMAIN";
const PI_BASH_APPROVAL_MARKER = "pi-bash-approved.marker";
const PI_BASH_REJECTION_MARKER = "pi-bash-rejected.marker";
const PI_BASH_SAFE_MARKER = "pi-bash-safe.marker";
const ABANDONED_RUN_MESSAGE = "ABANDONED_RUN_MESSAGE";
const FAILED_RETRY_MESSAGE = "请只回复 RETRY_OK，不要添加其他内容。";
const CHAT_JUMP_THREAD_TITLE = "CHAT_JUMP_LONG_SESSION";
const CHAT_JUMP_TARGET_MESSAGE = "CHAT_JUMP_TARGET_PAYPAL_STATUS";
const FAILED_APPROVED_TOOL_THREAD_TITLE = "FAILED_APPROVED_TOOL_RECOVERY";
const FAILED_APPROVED_TOOL_ERROR = "Domain not found: rf_fjxcezk5az";

function sessionsRoot() {
  return path.join(readE2eTestEnv().contentStorageRoot, "Sessions");
}

function contentStorageFile(name: string) {
  return path.join(readE2eTestEnv().contentStorageRoot, name);
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

function eventHasCompletedTool(event: Record<string, unknown>, toolName: string) {
  return (
    event.type === "assistant.turn" &&
    Array.isArray(event.blocks) &&
    event.blocks.some(
      (block) =>
        isRecord(block) &&
        (block.kind === "tool" || block.kind === "approval") &&
        block.toolName === toolName &&
        block.state === "completed",
    )
  );
}

function sessionHasCompletedTool(toolName: string) {
  return readPiEvents().some(
    (event) =>
      eventHasCompletedTool(event, toolName) ||
      (event.type === "tool.execution.completed" && event.toolName === toolName),
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
      type: "assistant.turn",
      messageId: "assistant_abandoned",
      text: "",
      blocks: [{ kind: "reasoning", text: "正在思考", createdAt: base.createdAt }],
    },
  ]) {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
  }
  manager.appendSessionInfo(ABANDONED_RUN_MESSAGE);
  flushPiSession(manager);
}

function seedFailedPiSession() {
  const root = readE2eTestEnv().contentStorageRoot;
  fs.mkdirSync(sessionsRoot(), { recursive: true });
  const manager = SessionManager.create(root, sessionsRoot());
  const sessionId = manager.getSessionId();
  const base = {
    sessionId,
    runId: "run_failed_retry",
    createdAt: "2026-06-23T00:00:00.000Z",
  };
  for (const event of [
    { ...base, id: "evt_failed_1", type: "run.started" },
    {
      ...base,
      id: "evt_failed_2",
      type: "user.message",
      messageId: "user_failed_retry",
      text: FAILED_RETRY_MESSAGE,
    },
    {
      ...base,
      id: "evt_failed_3",
      type: "run.failed",
      error: "Agent response was empty",
    },
  ]) {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
  }
  manager.appendSessionInfo(FAILED_RETRY_MESSAGE);
  flushPiSession(manager);
}

function seedCompletedPiSession({
  title,
  userText,
  assistantText,
}: {
  title: string;
  userText: string;
  assistantText: string;
}) {
  const root = readE2eTestEnv().contentStorageRoot;
  fs.mkdirSync(sessionsRoot(), { recursive: true });
  const manager = SessionManager.create(root, sessionsRoot());
  const sessionId = manager.getSessionId();
  const base = {
    sessionId,
    runId: `run_${title}`,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
  for (const event of [
    { ...base, id: `evt_${title}_1`, type: "run.started" },
    {
      ...base,
      id: `evt_${title}_2`,
      type: "user.message",
      messageId: `user_${title}`,
      text: userText,
    },
    {
      ...base,
      id: `evt_${title}_3`,
      type: "assistant.turn",
      messageId: `assistant_${title}`,
      text: assistantText,
      blocks: [{ kind: "text", text: assistantText, createdAt: base.createdAt }],
    },
    { ...base, id: `evt_${title}_4`, type: "run.completed" },
  ]) {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
  }
  manager.appendSessionInfo(title);
  flushPiSession(manager);
}

function seedLongPiSession() {
  const root = readE2eTestEnv().contentStorageRoot;
  fs.mkdirSync(sessionsRoot(), { recursive: true });
  const manager = SessionManager.create(root, sessionsRoot());
  const sessionId = manager.getSessionId();
  const createdAt = "2026-06-23T00:00:00.000Z";
  const prompts = [
    "https://martinfowler.com/eaaDev/uiArchs.html",
    "这篇文章内容被截断了（后半部分不见了）",
    "这篇 pdf 内容是啥",
    "抱歉，我目前可用的工具里没有直接读取 PDF 附件的功能",
    CHAT_JUMP_TARGET_MESSAGE,
    "方向对。我希望你把文档里的状态处理梳理出来",
  ];

  prompts.forEach((prompt, index) => {
    const runId = `run_jump_${index + 1}`;
    const userMessageId = `user_jump_${index + 1}`;
    const assistantMessageId = `assistant_jump_${index + 1}`;
    const base = {
      sessionId,
      runId,
      createdAt,
    };
    for (const event of [
      { ...base, id: `evt_jump_${index + 1}_1`, type: "run.started" },
      {
        ...base,
        id: `evt_jump_${index + 1}_2`,
        type: "user.message",
        messageId: userMessageId,
        text: prompt,
      },
      {
        ...base,
        id: `evt_jump_${index + 1}_3`,
        type: "assistant.turn",
        messageId: assistantMessageId,
        text: "这是一段用于撑开长对话的回复内容。它模拟 Agent 对用户问题的分析，包含多行文本，方便测试右侧用户消息跳转导航。\n\n".repeat(
          4,
        ),
        blocks: [
          {
            kind: "text",
            text: "这是一段用于撑开长对话的回复内容。它模拟 Agent 对用户问题的分析，包含多行文本，方便测试右侧用户消息跳转导航。\n\n".repeat(
              4,
            ),
            createdAt: base.createdAt,
          },
        ],
      },
      { ...base, id: `evt_jump_${index + 1}_4`, type: "run.completed" },
    ]) {
      manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
    }
  });
  manager.appendSessionInfo(CHAT_JUMP_THREAD_TITLE);
  flushPiSession(manager);
}

function normalizeProgressText(text: string) {
  return text
    .replaceAll("正在思考", "")
    .replaceAll("思考过程", "")
    .replaceAll("等待模型输出思考内容", "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readVisibleProgressText(page: Page) {
  for (const locator of [
    page.getByTestId("agent-assistant-text").last(),
    page.getByTestId("agent-reasoning").last(),
  ]) {
    if (!(await locator.isVisible().catch(() => false))) continue;
    const text = normalizeProgressText(await locator.innerText());
    if (text) return text;
  }
  return "";
}

async function waitForVisibleProgressText(page: Page) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    const text = await readVisibleProgressText(page);
    if (text.length >= 8) return text;
    await page.waitForTimeout(500);
  }
  throw new Error("Expected visible streaming progress text");
}

test.beforeEach(() => {
  resetAgentFixtures();
  fs.rmSync(sessionsRoot(), { recursive: true, force: true });
});

test("@AG-START-002 用户发送第一条消息后看到完整回复", async () => {
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

test("@AG-START-003 回复失败后用户可以继续发送消息", async () => {
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
    await sendMessage(page, "second。请直接回复 AG_START_003_REPLY，不要调用任何工具。");
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

test("@AG-START-006 用户重试失败回复后看到新的回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  seedFailedPiSession();
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await openThread(page, FAILED_RETRY_MESSAGE);
    await expect(page.getByTestId("agent-error-banner")).toContainText("回复失败");
    await page.getByTestId("agent-retry-button").click();
    await waitForAssistantReply(page);
    await expect(page.getByTestId("agent-error-banner")).toHaveCount(0);
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: FAILED_RETRY_MESSAGE }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-RUN-001 用户停止正在生成的回复", async () => {
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

test("@AG-RUN-002 用户停止回复后切换回来仍看到停止状态", async () => {
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

test("@AG-HISTORY-004 用户重新打开有未完成回复的对话后可以继续操作", async () => {
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

test("@AG-HISTORY-007 用户切回正在回复的对话后仍看到当前回复进度", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  seedCompletedPiSession({
    title: STREAM_SWITCH_OTHER_THREAD,
    userText: STREAM_SWITCH_OTHER_THREAD,
    assistantText: STREAM_SWITCH_OTHER_REPLY,
  });
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(page, SLOW_PROMPT);
    await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
    const progressText = await waitForVisibleProgressText(page);
    const progressSnippet = progressText.slice(0, 24);

    await openThread(page, STREAM_SWITCH_OTHER_THREAD);
    await expect(
      page.getByTestId("agent-assistant-text").filter({ hasText: STREAM_SWITCH_OTHER_REPLY }),
    ).toBeVisible();

    await openThread(page, SLOW_PROMPT.slice(0, 20));
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: SLOW_PROMPT }),
    ).toBeVisible();
    await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => readVisibleProgressText(page), { timeout: 30_000 })
      .toContain(progressSnippet);

    await page.getByTestId("agent-stop-button").click();
    await expect(page.getByTestId("agent-stopped-state")).toContainText("已停止", {
      timeout: 30_000,
    });
  } finally {
    await app.close();
  }
});

test("@AG-CONV-006 用户在长对话中通过右侧摘录跳转到指定消息", async () => {
  seedLongPiSession();
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openThread(page, CHAT_JUMP_THREAD_TITLE);
    await expect(page.getByTestId("agent-chat-jump-nav")).toBeVisible();
    await expect(page.getByTestId("agent-chat-jump-marker")).toHaveCount(6);
    const targetJumpItem = page
      .getByTestId("agent-chat-jump-item")
      .filter({ hasText: CHAT_JUMP_TARGET_MESSAGE });
    await expect(targetJumpItem).toHaveCount(1);
    await expect(page.getByTestId("agent-chat-jump-item").filter({ hasText: "Agent" })).toHaveCount(
      0,
    );

    await targetJumpItem.click();

    await expect(
      page
        .locator('[data-testid="agent-message-row"][data-highlighted="true"]')
        .filter({ hasText: CHAT_JUMP_TARGET_MESSAGE }),
    ).toBeVisible();
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-001 用户选中引用后发送消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await selectContext(page, "React", "React Server Components", "understanding");
    await selectContext(page, "React", "React", "domain");
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

test("@AG-CONTEXT-007 用户发送可读附件后看到 Agent 使用附件", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const filePath = writePdfAttachmentFile("PI_PDF_ATTACHMENT.pdf");
  const fileName = path.basename(filePath);
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    const fileChooser = page.waitForEvent("filechooser");
    await page.getByTestId("agent-attachment-button").click();
    await (await fileChooser).setFiles(filePath);
    await expect(page.getByTestId("agent-attachment-preview")).toContainText(fileName);
    await sendMessage(page, "请读取这个 PDF 附件，并直接回复其中的唯一英文单词");
    await expect(page.getByTestId("agent-message-attachment")).toContainText(fileName);
    const attachmentTool = page.getByTestId("agent-tool-activity").filter({ hasText: fileName });
    await expect(attachmentTool).toBeVisible({
      timeout: 120_000,
    });
    await attachmentTool.click();
    await expect(attachmentTool).toContainText("PDF 附件");
    await expect(attachmentTool).toContainText("1 页");
    await expect(page.getByTestId("agent-assistant-text").last()).toContainText(
      PDF_ATTACHMENT_PHRASE,
      { timeout: 120_000 },
    );
    await expect(page.getByTestId("agent-stop-button")).toBeHidden({ timeout: 120_000 });
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-HISTORY-005 用户发送附件后重启仍能看到附件", async () => {
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

test("@AG-CONTEXT-003 用户选择模型和推理强度后发送消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await page.getByTestId("agent-model-menu-button").click();
    const reasoningModel = page
      .locator('[data-testid="agent-model-option"][data-reasoning-levels~="medium"]')
      .first();
    const modelName = (await reasoningModel.locator("span").first().innerText()).trim();
    await reasoningModel.click();

    await page.getByTestId("agent-model-menu-button").click();
    await page
      .locator('[data-testid="agent-reasoning-option"][data-reasoning-level="medium"]')
      .click();
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("agent-model-menu-button")).toContainText(modelName);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
    await sendMessage(
      page,
      "请用一句话回复 model selection e2e。不要调用任何工具，只输出普通文本。",
    );
    await expect(page.getByTestId("agent-model-menu-button")).toContainText(modelName);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
    await waitForAssistantReply(page);
  } finally {
    await app.close();
  }
});

test("@AG-RETRIEVAL-003 用户要求 Agent 检索知识库后看到检索结果", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      "请必须使用知识检索工具 retrieve_knowledge 查找 React Server Components，并简短总结你找到的内容。",
    );
    await expect(page.getByTestId("agent-tool-activity")).toBeVisible({ timeout: 120_000 });
    await waitForAssistantReply(page);
    const toolActivity = page.getByTestId("agent-tool-activity").first();
    await toolActivity.click();
    await expect(toolActivity).toContainText("检索「React Server Components」");
    await expect(toolActivity).toContainText("Context 证据");

    const eventTypes = readPiEventTypes();
    expect(eventTypes).not.toContain("tool.started");
    expect(eventTypes).not.toContain("tool.completed");
    expect(eventTypes).not.toContain("approval.requested");
    expect(sessionHasCompletedTool("retrieve_knowledge")).toBe(true);
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-002 用户拒绝候选 Understanding 后看到拒绝结果", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须调用 understanding_create 工具提出候选 Understanding。标题必须是 ${PI_REJECT_PROPOSAL_TITLE}，正文写一行中文。等待我确认，不要直接写入。`,
    );
    const pendingCard = page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: PI_REJECT_PROPOSAL_TITLE });
    await expect(pendingCard).toBeVisible({ timeout: 120_000 });
    await pendingCard.getByTestId("agent-proposal-reject-button").click();
    const card = page.getByTestId("agent-proposal-card").last();
    await expect(card).toContainText("已拒绝", { timeout: 120_000 });
    await expect(card).toContainText("未写入知识库");

    expect(understandingExistsByTitle(PI_REJECT_PROPOSAL_TITLE)).toBe(false);
    const eventTypes = readPiEventTypes();
    expect(eventTypes).toContain("approval.requested");
    expect(eventTypes).toContain("approval.resolved");
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-001 用户确认候选 Understanding 后看到执行结果", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须调用 understanding_create 工具提出候选 Understanding。标题必须是 ${PI_APPROVE_PROPOSAL_TITLE}，正文写一行中文。等待我确认，不要直接写入。`,
    );
    const pendingCard = page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: PI_APPROVE_PROPOSAL_TITLE });
    await expect(pendingCard).toBeVisible({ timeout: 120_000 });
    await pendingCard.getByTestId("agent-proposal-confirm-button").click();
    const card = page.getByTestId("agent-proposal-card").last();
    await expect(card).toContainText("完成", { timeout: 120_000 });
    await expect(card).toContainText("已写入");

    expect(understandingExistsByTitle(PI_APPROVE_PROPOSAL_TITLE)).toBe(true);
    const eventTypes = readPiEventTypes();
    expect(eventTypes).toContain("approval.requested");
    expect(eventTypes).toContain("approval.resolved");
    expect(eventTypes).toContain("tool.execution.completed");
    expect(eventTypes).not.toContain("tool.completed");
    expect(sessionHasCompletedTool("understanding_create")).toBe(true);
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-004 用户确认候选 Domain 后看到执行结果", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须调用 domain_create 工具提出候选 Domain。名称必须是 ${PI_DOMAIN_PROPOSAL_NAME}。等待我确认，不要直接写入。`,
    );
    const pendingCard = page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: PI_DOMAIN_PROPOSAL_NAME });
    await expect(pendingCard).toBeVisible({ timeout: 120_000 });
    await pendingCard.getByTestId("agent-proposal-confirm-button").click();
    const card = page.getByTestId("agent-proposal-card").last();
    await expect(card).toContainText("完成", { timeout: 120_000 });
    await expect(card).toContainText("已写入");

    expect(domainExistsByName(PI_DOMAIN_PROPOSAL_NAME)).toBe(true);
    const events = readPiEvents();
    expect(
      events.some(
        (event) => event.type === "approval.requested" && event.toolName === "domain_create",
      ),
    ).toBe(true);
    expect(events.some((event) => event.type === "tool.execution.completed")).toBe(true);
    expect(sessionHasCompletedTool("domain_create")).toBe(true);
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-005 用户重新打开对话后仍能处理等待确认的提案", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(300_000);

  const prompt = `创建待确认 Understanding：请必须调用 understanding_create 工具提出候选 Understanding。标题必须是 ${PI_RELOAD_PROPOSAL_TITLE}，正文写一行中文。等待我确认，不要直接写入。`;
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
    const card = second.page.getByTestId("agent-proposal-card").last();
    await expect(card).toBeVisible();
    await card.getByTestId("agent-proposal-reject-button").click();
    await expect(card).toContainText("已拒绝", { timeout: 120_000 });
    expect(understandingExistsByTitle(PI_RELOAD_PROPOSAL_TITLE)).toBe(false);
  } finally {
    await second.app.close();
  }
});

test("@AG-PROPOSAL-007 用户重新打开对话后看到已批准工具执行失败原因", async () => {
  seedAgentThread({
    id: "failed-approved-tool-recovery",
    title: FAILED_APPROVED_TOOL_THREAD_TITLE,
    messages: [
      userMessage("failed-approved-tool-user", "请修改 Understanding"),
      assistantMessage("failed-approved-tool-assistant", [
        proposalPart({
          type: "understanding_update",
          toolCallId: "failed-approved-tool",
          title: "FAILED_APPROVED_TOOL",
          state: "output-error",
          approval: { id: "failed-approved-tool-approval", approved: true },
          errorText: FAILED_APPROVED_TOOL_ERROR,
        }),
      ]),
    ],
  });
  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });

  try {
    await openThread(page, FAILED_APPROVED_TOOL_THREAD_TITLE);
    const card = page
      .getByTestId("agent-proposal-card")
      .filter({ hasText: "候选修改 Understanding" });
    await expect(card).toContainText("执行失败");
    await expect(card).toContainText(FAILED_APPROVED_TOOL_ERROR);
    await expect(card).not.toContainText("已确认");

    const eventTypes = readPiEventTypes();
    expect(eventTypes).toContain("approval.requested");
    expect(eventTypes).toContain("approval.resolved");
    expect(eventTypes).toContain("tool.execution.started");
    expect(eventTypes).toContain("tool.execution.failed");
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-006 用户确认危险 Bash 后 Agent 继续回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });
  const markerPath = contentStorageFile(PI_BASH_APPROVAL_MARKER);
  fs.rmSync(markerPath, { force: true });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须先调用 bash 工具原样执行这个命令：printf sudo > ${PI_BASH_APPROVAL_MARKER}; printf approved。等我确认并且工具返回后，再简短说明已经完成；确认前不要声称命令已执行。`,
    );
    const card = page.getByTestId("agent-proposal-card").filter({ hasText: "确认危险 Bash" });
    await expect(card).toBeVisible({ timeout: 120_000 });

    await card.getByTestId("agent-proposal-confirm-button").click();
    await waitForAssistantReply(page);
    await expect(card).toContainText("完成", { timeout: 120_000 });
    await expect(page.getByTestId("agent-assistant-text").last()).toBeVisible();
    await expect(composer(page)).toBeEditable();
    expect(fs.readFileSync(markerPath, "utf-8")).toBe("sudo");

    const events = readPiEvents();
    const resolvedIndex = events.findIndex(
      (event) => event.type === "approval.resolved" && event.toolName === "bash",
    );
    const turnIndex = events.findIndex((event) => eventHasCompletedTool(event, "bash"));
    const runCompletedIndex = events.findIndex((event) => event.type === "run.completed");
    expect(resolvedIndex).toBeGreaterThanOrEqual(0);
    expect(turnIndex).toBeGreaterThan(resolvedIndex);
    expect(runCompletedIndex).toBeGreaterThan(turnIndex);
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-008 用户拒绝危险 Bash 后命令不执行", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });
  const markerPath = contentStorageFile(PI_BASH_REJECTION_MARKER);
  fs.rmSync(markerPath, { force: true });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须先调用 bash 工具原样执行这个命令：printf sudo > ${PI_BASH_REJECTION_MARKER}。如果我拒绝，不要重试工具，简短说明操作已取消。`,
    );
    const card = page.getByTestId("agent-proposal-card").filter({ hasText: "确认危险 Bash" });
    await expect(card).toBeVisible({ timeout: 120_000 });

    await card.getByTestId("agent-proposal-reject-button").click();
    await expect(card).toContainText("已拒绝", { timeout: 120_000 });
    await expect(page.getByTestId("agent-stop-button")).toBeHidden({ timeout: 120_000 });
    await expect(composer(page)).toBeEditable();
    expect(fs.existsSync(markerPath)).toBe(false);

    const events = readPiEvents();
    expect(
      events.some(
        (event) =>
          event.type === "approval.resolved" &&
          event.toolName === "bash" &&
          event.approved === false,
      ),
    ).toBe(true);
    expect(events.some((event) => eventHasCompletedTool(event, "bash"))).toBe(false);
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-009 用户让 Agent 执行普通 Bash 后直接看到结果", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(240_000);

  const { app, page } = await launchAgentPage({ REFLECTA_AGENT_RUNTIME: "pi" });
  const markerPath = contentStorageFile(PI_BASH_SAFE_MARKER);
  fs.rmSync(markerPath, { force: true });

  try {
    await createNewThread(page);
    await sendMessage(
      page,
      `请必须先调用 bash 工具原样执行这个命令：printf safe > ${PI_BASH_SAFE_MARKER}; printf done。工具返回后，再简短说明已经完成。`,
    );
    await waitForAssistantReply(page);
    const activity = page.getByTestId("agent-tool-activity").filter({ hasText: "Bash" });
    await expect(activity).toContainText("完成", { timeout: 120_000 });
    await expect(page.getByTestId("agent-assistant-text").last()).toBeVisible();
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "确认危险 Bash" }),
    ).toHaveCount(0);
    await expect(composer(page)).toBeEditable();
    expect(fs.readFileSync(markerPath, "utf-8")).toBe("safe");
    expect(sessionHasCompletedTool("bash")).toBe(true);
  } finally {
    await app.close();
  }
});

test("@AG-HISTORY-001 用户重启应用后仍能看到已完成对话", async () => {
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
