import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthStorage } from "@earendil-works/pi-coding-agent";
import type { AgentSessionEvent } from "@shared/agent";
import type { ResolvedAiModelConfig } from "../../config";
import {
  buildThreadTitleContext,
  configurePiRuntimeAuth,
  createPiResourceLoader,
  extractAssistantError,
  loadAgentSystemPrompt,
  normalizeGeneratedThreadTitle,
  PiAgentHost,
} from "./pi-agent-host";
import { AgentSessionLog } from "./pi-session-log";

vi.mock("./pi-readonly-tools", () => ({
  createPiReadOnlyTools: () => [],
  PI_READ_ONLY_TOOL_NAMES: [],
}));

vi.mock("./pi-write-tools", () => ({
  approvalTitleForTool: () => "候选操作",
  createPiWriteTools: () => [],
  executePiApprovedTool: vi.fn(),
  isPiApprovalToolName: () => false,
  PI_APPROVAL_TOOL_NAMES: [],
}));

vi.mock("./codex-auth", () => ({
  getCodexCredentials: vi.fn(async () => ({
    accessToken: "codex-access-token",
    accountId: "account-test",
  })),
}));

const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-pi-agent-host-"));
  roots.push(root);
  return root;
}

function modelConfig(input: {
  providerId: string;
  apiKey: string;
  authType?: "api-key" | "codex";
}): ResolvedAiModelConfig {
  return {
    provider: { id: input.providerId, apiKey: input.apiKey, models: [{ id: "model-test" }] },
    catalog: {
      id: input.providerId,
      name: input.providerId,
      baseUrl: "https://example.test",
      authType: input.authType,
      models: [{ id: "model-test" }],
    },
    model: { id: "model-test" },
    selection: { providerId: input.providerId, modelId: "model-test" },
    label: `${input.providerId} / model-test`,
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("configurePiRuntimeAuth", () => {
  test("uses Codex access token instead of the empty config key", async () => {
    const authStorage = AuthStorage.inMemory();

    await configurePiRuntimeAuth(
      authStorage,
      modelConfig({ providerId: "openai-codex", apiKey: "", authType: "codex" }),
    );

    await expect(authStorage.getApiKey("openai-codex")).resolves.toBe("codex-access-token");
  });

  test("uses configured API key for normal providers", async () => {
    const authStorage = AuthStorage.inMemory();

    await configurePiRuntimeAuth(
      authStorage,
      modelConfig({ providerId: "opencode-go", apiKey: "opencode-key" }),
    );

    await expect(authStorage.getApiKey("opencode-go")).resolves.toBe("opencode-key");
  });
});

describe("createPiResourceLoader", () => {
  test("loads the shared agent system prompt from markdown", () => {
    const expected = fs
      .readFileSync(new URL("./agent-system-prompt.md", import.meta.url), "utf8")
      .trim();

    expect(loadAgentSystemPrompt()).toBe(expected);
    expect(createPiResourceLoader().getSystemPrompt()).toBe(expected);
    expect(expected).toContain("你是 Reflecta 的认知辅助 Agent");
    expect(expected).toContain("可回看的个人理解");
    expect(expected).toContain("用户是大脑，AI 是辅助");
    expect(expected).toContain("System prompt 不枚举工具清单");
    expect(expected).not.toContain("understanding_list");
    expect(expected).not.toContain("includeContexts");
    expect(expected).not.toContain("`graph`");
    expect(expected).not.toContain("You are Reflecta's agent");
  });
});

describe("PiAgentHost", () => {
  test("preserves Pi assistant error messages instead of reporting an empty response", () => {
    expect(
      extractAssistantError({
        role: "assistant",
        stopReason: "error",
        errorMessage: "Cannot find module './openai-completions-old.js'",
      }),
    ).toBe("Cannot find module './openai-completions-old.js'");
  });

  test("builds title prompts from reduced session messages", () => {
    const context = buildThreadTitleContext([
      {
        id: "evt_1",
        sessionId: "session_1",
        runId: "run_1",
        type: "user.message",
        messageId: "user_1",
        text: "我想比较内容存储和应用缓存应该怎么分层",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
      {
        id: "evt_2",
        sessionId: "session_1",
        runId: "run_1",
        type: "assistant.text.delta",
        messageId: "assistant_1",
        delta: "可以把 session、db 和文件保留，",
        createdAt: "2026-06-23T00:00:01.000Z",
      },
      {
        id: "evt_3",
        sessionId: "session_1",
        runId: "run_1",
        type: "assistant.text.delta",
        messageId: "assistant_1",
        delta: "索引和日志跟应用卸载。",
        createdAt: "2026-06-23T00:00:02.000Z",
      },
    ]);

    expect(context?.systemPrompt).toContain("对话标题生成器");
    expect(context?.messages[0]?.content).toContain("用户: 我想比较内容存储和应用缓存应该怎么分层");
    expect(context?.messages[0]?.content).toContain(
      "Agent: 可以把 session、db 和文件保留，索引和日志跟应用卸载。",
    );
  });

  test("normalizes model title output before saving it", () => {
    expect(normalizeGeneratedThreadTitle("```markdown\n# 标题：存储路径分层方案\n```")).toBe(
      "存储路径分层方案",
    );
  });

  test("renames a thread using the configured title generator", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession("新对话");
    const manager = await log.openSession(session.id);
    const event: AgentSessionEvent = {
      id: "evt_1",
      sessionId: session.id,
      runId: "run_1",
      type: "user.message",
      messageId: "user_1",
      text: "帮我生成一个标题",
      createdAt: "2026-06-23T00:00:00.000Z",
    };
    log.appendEvent(manager, event);

    const title = await new PiAgentHost(root, async (events, contentStorageRoot) => {
      expect(events).toEqual([event]);
      expect(contentStorageRoot).toBe(root);
      return "“AI 标题”";
    }).generateThreadTitle(session.id);

    expect(title).toBe("AI 标题");
    await expect(new AgentSessionLog(root).listSessions()).resolves.toMatchObject([
      { id: session.id, title: "AI 标题" },
    ]);
  });

  test("does not overwrite a non-empty thread with the generic generated-title fallback", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession("新对话");
    const manager = await log.openSession(session.id);
    log.appendEvent(manager, {
      id: "evt_1",
      sessionId: session.id,
      runId: "run_1",
      type: "user.message",
      messageId: "user_1",
      text: "为什么生产环境导出 Markdown 没有反应",
      createdAt: "2026-06-23T00:00:00.000Z",
    });

    const title = await new PiAgentHost(root, async () => "新对话").generateThreadTitle(session.id);

    expect(title).toBe("为什么生产环境导出 Markdown 没有反应");
    await expect(log.listSessions()).resolves.toMatchObject([{ id: session.id, title }]);
  });

  test("closes restored sessions whose last run never reached a terminal event", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession("abandoned");
    const manager = await log.openSession(session.id);
    const events: AgentSessionEvent[] = [
      {
        id: "evt_1",
        sessionId: session.id,
        runId: "run_1",
        type: "run.started",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
      {
        id: "evt_2",
        sessionId: session.id,
        runId: "run_1",
        type: "user.message",
        messageId: "user_1",
        text: "hello",
        createdAt: "2026-06-23T00:00:01.000Z",
      },
    ];
    for (const event of events) log.appendEvent(manager, event);

    const restored = await new PiAgentHost(root).readSessionEvents(session.id);

    expect(restored.map((event) => event.type)).toEqual([
      "run.started",
      "user.message",
      "run.cancelled",
    ]);
    await expect(new AgentSessionLog(root).readEvents(session.id)).resolves.toEqual(restored);
  });
});
