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
import { AgentEntitySourceRegistry } from "./agent-entity-sources";
import { AgentSessionLog } from "./pi-session-log";

const createAgentSessionMock = vi.hoisted(() => vi.fn());
const executePiApprovedToolMock = vi.hoisted(() => vi.fn());
const getModelMock = vi.hoisted(() => vi.fn(() => ({ id: "model-test" })));
const isPiApprovalToolNameMock = vi.hoisted(() => vi.fn((_name: string) => false));

vi.mock("@earendil-works/pi-ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@earendil-works/pi-ai")>()),
  getModel: getModelMock,
}));

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@earendil-works/pi-coding-agent")>()),
  createAgentSession: createAgentSessionMock,
}));

vi.mock("../../config", () => ({
  getActiveAgentReasoningLevel: () => "medium",
  getAiModelConfig: () => ({
    provider: { id: "openai", apiKey: "openai-key", models: [{ id: "gpt-4o" }] },
    catalog: {
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      models: [{ id: "gpt-4o" }],
    },
    model: { id: "gpt-4o" },
    selection: { providerId: "openai", modelId: "gpt-4o" },
    label: "OpenAI / gpt-4o",
  }),
  getContentStorageRoot: () => "/tmp/reflecta-pi-agent-host-test-content",
  getTitleGenerationAiModelConfig: () => ({
    provider: { id: "openai", apiKey: "openai-key", models: [{ id: "gpt-4o" }] },
    catalog: {
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      models: [{ id: "gpt-4o" }],
    },
    model: { id: "gpt-4o" },
    selection: { providerId: "openai", modelId: "gpt-4o" },
    label: "OpenAI / gpt-4o",
  }),
}));

vi.mock("./pi-readonly-tools", () => ({
  createPiReadOnlyTools: () => [],
  PI_READ_ONLY_TOOL_NAMES: [],
}));

vi.mock("./pi-write-tools", () => ({
  approvalTitleForTool: () => "候选操作",
  createPiWriteTools: () => [],
  executePiApprovedTool: executePiApprovedToolMock,
  isPiApprovalToolName: isPiApprovalToolNameMock,
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
  vi.clearAllMocks();
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

  test("decorates approved mutation outputs as entity refs", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_create");
    executePiApprovedToolMock.mockResolvedValue({
      resultRefType: "understanding",
      resultRefId: "understanding_1",
    });
    const registry = new AgentEntitySourceRegistry([], () => "rf_understanding");

    const output = await (
      new PiAgentHost(tempRoot()) as unknown as {
        executeApprovedTool: (
          requested: AgentSessionEvent & {
            type: "approval.requested";
          },
          registry: AgentEntitySourceRegistry,
        ) => Promise<unknown>;
      }
    ).executeApprovedTool(
      {
        id: "evt_approval",
        sessionId: "session_1",
        runId: "run_1",
        type: "approval.requested",
        messageId: "assistant_1",
        approvalId: "approval_tool_1",
        toolCallId: "tool_1",
        toolName: "understanding_create",
        title: "候选 Understanding",
        payload: { title: "A", body: "B" },
        createdAt: "2026-06-26T00:00:00.000Z",
      },
      registry,
    );

    expect(output).toEqual({
      resultRefType: "understanding",
      resultRefId: "understanding_1",
      resultRef: "[[understanding:understanding_1]]",
    });
    expect(registry.drainUpdates()).toEqual([
      {
        sourceId: "rf_understanding",
        entity: { type: "understanding", id: "understanding_1" },
        origin: {
          kind: "tool_result",
          toolCallId: "tool_1",
          toolName: "understanding_create",
        },
      },
    ]);
  });

  test("persists approved tool execution events after approval succeeds", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_update");
    executePiApprovedToolMock.mockResolvedValue({
      resultRefType: "understanding",
      resultRefId: "understanding_1",
    });
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("新对话");
    const manager = await log.openSession(thread.id);
    log.appendEvent(manager, {
      id: "evt_approval",
      sessionId: thread.id,
      runId: "run_1",
      type: "approval.requested",
      messageId: "assistant_1",
      approvalId: "approval_tool_1",
      toolCallId: "tool_1",
      toolName: "understanding_update",
      title: "候选修改 Understanding",
      payload: { understandingId: "understanding_1", body: "next" },
      createdAt: "2026-06-26T00:00:00.000Z",
    });
    const webContents = { isDestroyed: () => false, send: vi.fn() };

    await (
      new PiAgentHost(root) as unknown as {
        resolveToolApproval: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).resolveToolApproval(
      { type: "tool.approve", sessionId: thread.id, approvalId: "approval_tool_1" },
      webContents,
    );

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    expect(events.map((event) => event.type)).toEqual([
      "approval.requested",
      "approval.resolved",
      "tool.execution.started",
      "entity.sources.updated",
      "tool.execution.completed",
      "assistant.turn",
    ]);
    expect(events.find((event) => event.type === "tool.execution.completed")).toMatchObject({
      type: "tool.execution.completed",
      toolCallId: "tool_1",
      toolName: "understanding_update",
      output: {
        resultRefType: "understanding",
        resultRefId: "understanding_1",
        resultRef: "[[understanding:understanding_1]]",
      },
    });
  });

  test("persists approved tool execution failures with structured errors", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_update");
    executePiApprovedToolMock.mockRejectedValue(new Error("Domain not found: domain_1"));
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("新对话");
    const manager = await log.openSession(thread.id);
    log.appendEvent(manager, {
      id: "evt_approval",
      sessionId: thread.id,
      runId: "run_1",
      type: "approval.requested",
      messageId: "assistant_1",
      approvalId: "approval_tool_1",
      toolCallId: "tool_1",
      toolName: "understanding_update",
      title: "候选修改 Understanding",
      payload: { understandingId: "understanding_1", domainIds: ["domain_1"] },
      createdAt: "2026-06-26T00:00:00.000Z",
    });
    const webContents = { isDestroyed: () => false, send: vi.fn() };

    await (
      new PiAgentHost(root) as unknown as {
        resolveToolApproval: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).resolveToolApproval(
      { type: "tool.approve", sessionId: thread.id, approvalId: "approval_tool_1" },
      webContents,
    );

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    expect(events.map((event) => event.type)).toEqual([
      "approval.requested",
      "approval.resolved",
      "tool.execution.started",
      "tool.execution.failed",
      "assistant.turn",
    ]);
    expect(events.find((event) => event.type === "tool.execution.failed")).toMatchObject({
      type: "tool.execution.failed",
      toolCallId: "tool_1",
      toolName: "understanding_update",
      error: { message: "Domain not found: domain_1" },
    });
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
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "可以把 session、db 和文件保留，索引和日志跟应用卸载。",
        blocks: [
          {
            kind: "text",
            text: "可以把 session、db 和文件保留，索引和日志跟应用卸载。",
            createdAt: "2026-06-23T00:00:01.000Z",
          },
        ],
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

  test("persists entity sources for user context refs before the user message", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("新对话");
    const manager = await log.openSession(thread.id);
    log.appendEvent(manager, {
      id: "evt_existing_run",
      sessionId: thread.id,
      runId: "run_existing",
      type: "run.started",
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    log.appendEvent(manager, {
      id: "evt_existing_user",
      sessionId: thread.id,
      runId: "run_existing",
      type: "user.message",
      messageId: "user_1",
      text: "旧问题",
      createdAt: "2026-06-23T00:00:01.000Z",
    });
    log.appendEvent(manager, {
      id: "evt_existing_cancel",
      sessionId: thread.id,
      runId: "run_existing",
      type: "run.cancelled",
      createdAt: "2026-06-23T00:00:02.000Z",
    });
    const promptCalls: string[] = [];
    createAgentSessionMock.mockResolvedValueOnce({
      session: {
        sessionManager: manager,
        subscribe: () => () => {},
        prompt: vi.fn(async (prompt: string) => {
          promptCalls.push(prompt);
        }),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const webContents = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).sendMessage(
      {
        type: "message.send",
        sessionId: thread.id,
        messageId: "user_1",
        text: "请解释这个 context",
        contextRefs: [{ type: "context", id: "ctx_1", title: "一次复盘" }],
        modelSelection: { providerId: "openai", modelId: "gpt-4o" },
      },
      webContents as never,
    );

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    const newEvents = events.slice(3);

    expect(createAgentSessionMock).toHaveBeenCalledTimes(1);
    expect(newEvents.map((event) => event.type).slice(0, 3)).toEqual([
      "run.started",
      "entity.sources.updated",
      "user.message",
    ]);
    const sourceUpdate = events.find((event) => event.type === "entity.sources.updated");
    if (sourceUpdate?.type !== "entity.sources.updated") {
      throw new Error("Expected entity source update event");
    }
    const source = sourceUpdate.sources[0];
    expect(source).toEqual(
      expect.objectContaining({
        entity: { type: "context", id: "ctx_1", title: "一次复盘" },
        origin: { kind: "user_context", messageId: "user_1" },
      }),
    );
    expect(source?.sourceId).toMatch(/^rf_[a-z0-9]+$/);
    expect(promptCalls[0]).toContain("[[context:ctx_1]] Context: 一次复盘 (id: ctx_1)");
    expect(promptCalls[0]).not.toContain(`[[ref:${source?.sourceId}]]`);
  });

  test("persists provider usage on the assistant turn", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("新对话");
    const manager = await log.openSession(thread.id);
    log.appendEvent(manager, {
      id: "evt_existing_cancel",
      sessionId: thread.id,
      runId: "run_existing",
      type: "run.cancelled",
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    const usage = {
      input: 21_000,
      output: 700,
      cacheRead: 100_000,
      cacheWrite: 0,
      totalTokens: 121_700,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
    let listener: ((event: unknown) => void) | undefined;
    createAgentSessionMock.mockResolvedValueOnce({
      session: {
        sessionManager: manager,
        subscribe: (next: (event: unknown) => void) => {
          listener = next;
          return () => {};
        },
        prompt: vi.fn(async () => {
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "完成" },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "完成" }],
              usage,
              provider: "openai",
              model: "gpt-5.3-codex-spark",
              stopReason: "stop",
            },
          });
        }),
        getContextUsage: vi.fn(() => ({
          tokens: 121_700,
          contextWindow: 128_000,
          percent: 95.078125,
        })),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const webContents = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).sendMessage(
      {
        type: "message.send",
        sessionId: thread.id,
        text: "统计上下文",
        modelSelection: { providerId: "openai", modelId: "gpt-4o" },
      },
      webContents as never,
    );

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    const turn = events.find((event) => event.type === "assistant.turn");

    expect(turn).toEqual(
      expect.objectContaining({
        type: "assistant.turn",
        text: "完成",
        usage,
        contextUsage: {
          tokens: 121_700,
          contextWindow: 128_000,
          percent: 95.078125,
        },
        model: { providerId: "openai", modelId: "gpt-5.3-codex-spark" },
        stopReason: "stop",
      }),
    );
  });

  test("restores the active streaming turn when reopening a running session", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("新对话");
    const manager = await log.openSession(thread.id);
    log.appendEvent(manager, {
      id: "evt_existing_cancel",
      sessionId: thread.id,
      runId: "run_existing",
      type: "run.cancelled",
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    let listener: ((event: unknown) => void) | undefined;
    let finishPrompt!: () => void;
    let promptStarted!: () => void;
    const promptStartedPromise = new Promise<void>((resolve) => {
      promptStarted = resolve;
    });
    const promptFinishedPromise = new Promise<void>((resolve) => {
      finishPrompt = resolve;
    });
    createAgentSessionMock.mockResolvedValueOnce({
      session: {
        sessionManager: manager,
        subscribe: (next: (event: unknown) => void) => {
          listener = next;
          return () => {};
        },
        prompt: vi.fn(async () => {
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "前半段回复" },
          });
          promptStarted();
          await promptFinishedPromise;
        }),
        getContextUsage: vi.fn(() => undefined),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const webContents = {
      isDestroyed: () => false,
      send: vi.fn(),
    };
    const host = new PiAgentHost(root);

    const sendPromise = (
      host as unknown as {
        sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).sendMessage(
      {
        type: "message.send",
        sessionId: thread.id,
        text: "开始流式回复",
        modelSelection: { providerId: "openai", modelId: "gpt-4o" },
      },
      webContents as never,
    );
    await promptStartedPromise;

    const restored = await host.readSessionEvents(thread.id);
    const restoredTurn = restored.find((event) => event.type === "assistant.turn");

    expect(restoredTurn).toEqual(
      expect.objectContaining({
        type: "assistant.turn",
        text: "前半段回复",
        blocks: [expect.objectContaining({ kind: "text", text: "前半段回复" })],
      }),
    );
    await expect(new AgentSessionLog(root).readEvents(thread.id)).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "assistant.turn" })]),
    );

    finishPrompt();
    await sendPromise;
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
