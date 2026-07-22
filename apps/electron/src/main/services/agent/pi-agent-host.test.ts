import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModelRegistry, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { KnownProvider } from "@earendil-works/pi-ai/compat";
import type { AgentSessionEvent } from "@shared/agent";
import type { ResolvedAiModelConfig } from "../../config";
import {
  AGENT_EVENT_CHANNEL,
  buildThreadTitleContext,
  createPiBashTool,
  createPiModelRuntime,
  createPiResourceLoader,
  extractAssistantError,
  loadAgentSystemPrompt,
  normalizeGeneratedThreadTitle,
  PI_BUILTIN_TOOL_NAMES,
  PiAgentHost,
} from "./pi-agent-host";
import { AgentEntityCatalog } from "./agent-entity-catalog";
import { AgentSessionLog } from "./pi-session-log";
import { PI_WEB_ACCESS_TOOL_NAMES } from "./pi-web-access";

const createAgentSessionMock = vi.hoisted(() => vi.fn());
const executePiApprovedToolMock = vi.hoisted(() => vi.fn());
const hydratePiApprovalPayloadMock = vi.hoisted(() =>
  vi.fn(async (_toolName: string, payload: Record<string, unknown>) => payload),
);
const getModelMock = vi.hoisted(() => vi.fn(() => ({ id: "model-test" })));
const isPiApprovalToolNameMock = vi.hoisted(() => vi.fn((_name: string) => false));

vi.mock("@earendil-works/pi-ai/compat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@earendil-works/pi-ai/compat")>()),
  getModel: getModelMock,
}));

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@earendil-works/pi-coding-agent")>()),
  createAgentSession: createAgentSessionMock,
}));

vi.mock("../../config", () => ({
  getActiveAgentReasoningLevel: () => "medium",
  getAiModelConfig: () => ({
    provider: { id: "openai", apiKey: "openai-key", enabledModelIds: ["gpt-4o"] },
    definition: {
      id: "openai",
      name: "OpenAI",
      piProviderId: "openai",
      models: [{ id: "gpt-4o", name: "GPT-4o", supportedReasoningLevels: ["off"] }],
    },
    model: { id: "gpt-4o", name: "GPT-4o", supportedReasoningLevels: ["off"] },
    selection: { providerId: "openai", modelId: "gpt-4o" },
    label: "OpenAI / gpt-4o",
  }),
  getContentStorageRoot: () => "/tmp/reflecta-pi-agent-host-test-content",
  getTitleGenerationAiModelConfig: () => ({
    provider: { id: "openai", apiKey: "openai-key", enabledModelIds: ["gpt-4o"] },
    definition: {
      id: "openai",
      name: "OpenAI",
      piProviderId: "openai",
      models: [{ id: "gpt-4o", name: "GPT-4o", supportedReasoningLevels: ["off"] }],
    },
    model: { id: "gpt-4o", name: "GPT-4o", supportedReasoningLevels: ["off"] },
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
  hydratePiApprovalPayload: hydratePiApprovalPayloadMock,
  isPiApprovalToolName: isPiApprovalToolNameMock,
  PI_APPROVAL_TOOL_NAMES: [],
}));

vi.mock("./codex-auth", () => ({
  getCodexCredentials: vi.fn(async () => ({
    accessToken: "codex-access-token",
    refreshToken: "codex-refresh-token",
    expiresAt: 4_102_444_800_000,
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
    provider: { id: input.providerId, apiKey: input.apiKey, enabledModelIds: ["model-test"] },
    definition: {
      id: input.providerId,
      name: input.providerId,
      piProviderId: input.providerId as KnownProvider,
      authType: input.authType,
      models: [{ id: "model-test", name: "model-test", supportedReasoningLevels: ["off"] }],
    },
    model: { id: "model-test", name: "model-test", supportedReasoningLevels: ["off"] },
    selection: { providerId: input.providerId, modelId: "model-test" },
    label: `${input.providerId} / model-test`,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("createPiModelRuntime", () => {
  test("makes an existing Codex login usable by the Agent and extensions", async () => {
    const root = tempRoot();
    const modelRuntime = await createPiModelRuntime(
      root,
      modelConfig({ providerId: "openai-codex", apiKey: "", authType: "codex" }),
    );

    const model = modelRuntime.getModels("openai-codex")[0];
    expect(model).toBeDefined();
    const auth = await new ModelRegistry(modelRuntime).getApiKeyAndHeaders(model!);
    expect(auth).toMatchObject({ ok: true, apiKey: "codex-access-token" });
  });

  test("uses configured API key for normal providers", async () => {
    const modelRuntime = await createPiModelRuntime(
      tempRoot(),
      modelConfig({ providerId: "opencode-go", apiKey: "opencode-key" }),
    );

    const model = modelRuntime.getModels("opencode-go")[0];
    expect(model).toBeDefined();
    const auth = await new ModelRegistry(modelRuntime).getApiKeyAndHeaders(model!);
    expect(auth).toMatchObject({ ok: true, apiKey: "opencode-key" });
  });
});

describe("createPiResourceLoader", () => {
  test("loads the shared system prompt and Reflecta runtime policies", async () => {
    const expected = fs
      .readFileSync(new URL("./agent-system-prompt.md", import.meta.url), "utf8")
      .trim();
    const root = tempRoot();
    const loader = await createPiResourceLoader({
      cwd: root,
      agentDir: path.join(root, ".pi-agent"),
      settingsManager: SettingsManager.inMemory({}),
      onDangerousBashApproval: vi.fn().mockResolvedValue(true),
      getEntityCatalog: () => [],
    });

    expect(loadAgentSystemPrompt()).toBe(expected);
    expect(loader.getSystemPrompt()).toBe(expected);
    expect(loader.getExtensions().extensions.map((extension) => extension.path)).toEqual([
      expect.stringMatching(/pi-web-access\/index\.ts$/),
      "<inline:reflecta-web-access-policy>",
      "<inline:reflecta-bash-permission-gate>",
      "<inline:reflecta-entity-catalog-context>",
      "<inline:reflecta-context-compaction>",
    ]);
    expect(loader.getSkills().skills).toEqual([]);
    expect(loader.getPrompts().prompts).toEqual([]);
    expect(loader.getThemes().themes).toEqual([]);
    expect(loader.getAgentsFiles().agentsFiles).toEqual([]);
    expect(expected).toContain("你是 Reflecta 的认知辅助 Agent");
    expect(expected).toContain("原样复制该实体的 `citation` 字段");
    expect(expected).toContain("调用工具时只传 `id` 字段");
    expect(expected).toContain("问题依赖可能变化的外部事实时");
    expect(expected).not.toMatch(/web_search|fetch_content|get_search_content/);
  });
});

describe("createPiBashTool", () => {
  test("keeps Chinese filenames readable when the app process has a C locale", async () => {
    vi.stubEnv("LANG", "C");
    vi.stubEnv("LC_ALL", "C");
    vi.stubEnv("LC_CTYPE", "C");
    const root = tempRoot();
    fs.writeFileSync(path.join(root, "分析-页面.md"), "content");
    const tool = createPiBashTool(root);
    const execute = tool.execute as unknown as (
      toolCallId: string,
      params: { command: string },
    ) => Promise<{ content: Array<{ type: string; text?: string }> }>;
    const result = await execute("tool_1", { command: 'wc -c "分析-页面.md"' });

    expect(result.content[0]?.text).toContain("分析-页面.md");
    expect(result.content[0]?.text).not.toContain("??-??.md");
  });
});

describe("PiAgentHost", () => {
  test("manually compacts a conversation and persists a visible checkpoint event", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("需要整理的对话");
    const manager = await log.openSession(thread.id);
    const events: AgentSessionEvent[] = [
      {
        id: "evt_run",
        sessionId: thread.id,
        runId: "run_1",
        type: "run.started",
        createdAt: "2026-07-21T00:00:00.000Z",
      },
      {
        id: "evt_user",
        sessionId: thread.id,
        runId: "run_1",
        type: "user.message",
        messageId: "user_1",
        text: "请保留我的约束",
        createdAt: "2026-07-21T00:00:01.000Z",
      },
      {
        id: "evt_assistant",
        sessionId: thread.id,
        runId: "run_1",
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "好的",
        blocks: [{ kind: "text", text: "好的", createdAt: "2026-07-21T00:00:02.000Z" }],
        createdAt: "2026-07-21T00:00:02.000Z",
      },
      {
        id: "evt_completed",
        sessionId: thread.id,
        runId: "run_1",
        type: "run.completed",
        createdAt: "2026-07-21T00:00:03.000Z",
      },
    ];
    for (const event of events) log.appendEvent(manager, event);

    let listener: ((event: unknown) => void) | undefined;
    const compact = vi.fn(async () => {
      listener?.({ type: "compaction_start", reason: "manual" });
      listener?.({
        type: "compaction_end",
        reason: "manual",
        result: {
          summary: "## 当前意图\n继续验证上下文压缩",
          firstKeptEntryId: "entry_kept",
          tokensBefore: 120_000,
          estimatedTokensAfter: 18_000,
        },
      });
    });
    createAgentSessionMock.mockResolvedValueOnce({
      session: {
        sessionManager: manager,
        model: { contextWindow: 128_000 },
        subscribe: (next: (event: unknown) => void) => {
          listener = next;
          return () => {};
        },
        compact,
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const webContents = { isDestroyed: () => false, send: vi.fn() };

    await new PiAgentHost(root).sendAgentCommand(
      {
        type: "context.compact",
        sessionId: thread.id,
        modelSelection: { providerId: "openai", modelId: "gpt-4o" },
      },
      webContents as never,
    );

    expect(compact).toHaveBeenCalledOnce();
    await expect(new AgentSessionLog(root).readEvents(thread.id)).resolves.toEqual([
      ...events,
      expect.objectContaining({
        type: "context.compacted",
        reason: "manual",
        summary: "## 当前意图\n继续验证上下文压缩",
        tokensBefore: 120_000,
        estimatedTokensAfter: 18_000,
        contextWindow: 128_000,
        afterMessageId: "assistant_1",
      }),
    ]);
    expect(webContents.send.mock.calls.map(([, event]) => event.type)).toEqual([
      "context.compaction.started",
      "context.compaction.finished",
      "context.compacted",
    ]);
  });

  test("reports a short manual compaction without persisting a checkpoint", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("短对话");
    const manager = await log.openSession(thread.id);
    const userEvent: AgentSessionEvent = {
      id: "evt_user",
      sessionId: thread.id,
      runId: "run_1",
      type: "user.message",
      messageId: "user_1",
      text: "刚开始聊",
      createdAt: "2026-07-21T00:00:00.000Z",
    };
    log.appendEvent(manager, userEvent);

    let listener: ((event: unknown) => void) | undefined;
    createAgentSessionMock.mockResolvedValueOnce({
      session: {
        sessionManager: manager,
        model: { contextWindow: 128_000 },
        subscribe: (next: (event: unknown) => void) => {
          listener = next;
          return () => {};
        },
        compact: vi.fn(async () => {
          listener?.({ type: "compaction_start", reason: "manual" });
          listener?.({
            type: "compaction_end",
            reason: "manual",
            errorMessage: "Compaction failed: Nothing to compact (session too small)",
          });
          throw new Error("Nothing to compact (session too small)");
        }),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const webContents = { isDestroyed: () => false, send: vi.fn() };

    await expect(
      new PiAgentHost(root).sendAgentCommand(
        { type: "context.compact", sessionId: thread.id },
        webContents as never,
      ),
    ).rejects.toThrow("当前对话还不需要压缩");

    await expect(new AgentSessionLog(root).readEvents(thread.id)).resolves.toEqual([userEvent]);
    expect(webContents.send.mock.calls.map(([, event]) => event)).toEqual([
      expect.objectContaining({ type: "context.compaction.started" }),
      expect.objectContaining({
        type: "context.compaction.finished",
        error: "当前对话还不需要压缩",
      }),
    ]);
  });

  test("rejects manual compaction while the conversation is already running", async () => {
    const host = new PiAgentHost(tempRoot());
    (
      host as unknown as {
        activeRuns: Map<string, unknown>;
      }
    ).activeRuns.set("session_busy", {});

    await expect(
      host.sendAgentCommand({ type: "context.compact", sessionId: "session_busy" }, {
        isDestroyed: () => false,
        send: vi.fn(),
      } as never),
    ).rejects.toThrow("当前对话正在处理中，请稍后再压缩上下文");
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });

  test("preserves Pi assistant error messages instead of reporting an empty response", () => {
    expect(
      extractAssistantError({
        role: "assistant",
        stopReason: "error",
        errorMessage: "Cannot find module './openai-completions-old.js'",
      }),
    ).toBe("Cannot find module './openai-completions-old.js'");
  });

  test("collects approved mutation outputs in the entity catalog", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_create");
    executePiApprovedToolMock.mockResolvedValue({
      resultRefType: "understanding",
      resultRefId: "understanding_1",
      resultRefTitle: "Stored Understanding",
    });
    const catalog = new AgentEntityCatalog();

    const output = await (
      new PiAgentHost(tempRoot()) as unknown as {
        executeApprovedTool: (
          requested: AgentSessionEvent & {
            type: "approval.requested";
          },
          registry: AgentEntityCatalog,
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
      catalog,
    );

    expect(output).toEqual({
      resultRefType: "understanding",
      resultRefId: "understanding_1",
      resultRefTitle: "Stored Understanding",
    });
    expect(catalog.drainUpdates()).toEqual([
      {
        key: "understanding:understanding_1",
        entity: {
          type: "understanding",
          id: "understanding_1",
          title: "Stored Understanding",
        },
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
      "entity.catalog.updated",
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

  test("persists entity catalog entries for user context refs before the user message", async () => {
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
      "entity.catalog.updated",
      "user.message",
    ]);
    const catalogUpdate = events.find((event) => event.type === "entity.catalog.updated");
    if (catalogUpdate?.type !== "entity.catalog.updated") {
      throw new Error("Expected entity catalog update event");
    }
    const entry = catalogUpdate.entries[0];
    expect(entry).toEqual(
      expect.objectContaining({
        key: "context:ctx_1",
        entity: { type: "context", id: "ctx_1", title: "一次复盘" },
        origin: { kind: "user_context", messageId: expect.any(String) },
      }),
    );
    expect(promptCalls[0]).toContain("Context: 一次复盘; id=ctx_1");
    expect(promptCalls[0]).not.toContain("<reflecta_entities");
    expect(promptCalls[0]).not.toContain("sourceId");
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
    expect(events.map((event) => event.type)).not.toContain("assistant.text.delta");
    expect(webContents.send).toHaveBeenCalledWith(
      AGENT_EVENT_CHANNEL,
      expect.objectContaining({ type: "assistant.text.delta", delta: "完成" }),
    );
  });

  test("streams and persists plain text with direct entity citations", async () => {
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
            assistantMessageEvent: {
              type: "text_delta",
              delta: "放在三观下面 [[d:domain_1]]。",
            },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "放在三观下面 [[d:domain_1]]。" }],
              provider: "openai",
              model: "gpt-4o",
              stopReason: "stop",
            },
          });
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

    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).sendMessage(
      {
        type: "message.send",
        sessionId: thread.id,
        text: "放在哪个 domain",
        contextRefs: [{ type: "domain", id: "domain_1", title: "三观" }],
        modelSelection: { providerId: "openai", modelId: "gpt-4o" },
      },
      webContents as never,
    );

    const sessionOptions = createAgentSessionMock.mock.calls.at(-1)?.[0] as {
      customTools?: { name: string }[];
      tools?: string[];
    };
    expect(sessionOptions.customTools?.map((tool) => tool.name)).not.toContain(
      "reflecta_final_answer",
    );
    expect(sessionOptions.tools).toEqual(expect.arrayContaining([...PI_BUILTIN_TOOL_NAMES]));
    expect(sessionOptions.tools).toEqual(expect.arrayContaining([...PI_WEB_ACCESS_TOOL_NAMES]));
    expect(sessionOptions.tools).not.toContain("web_fetch");
    expect(sessionOptions.tools).not.toContain("reflecta_final_answer");
    const events = await new AgentSessionLog(root).readEvents(thread.id);
    expect(events.slice(1).map((event) => event.type)).toEqual([
      "run.started",
      "entity.catalog.updated",
      "user.message",
      "assistant.turn",
      "run.completed",
    ]);
    expect(events.find((event) => event.type === "assistant.turn")).toMatchObject({
      type: "assistant.turn",
      text: "放在三观下面 [[d:domain_1]]。",
      blocks: [
        {
          kind: "text",
          text: "放在三观下面 [[d:domain_1]]。",
        },
      ],
    });
    const textDeltas = webContents.send.mock.calls
      .map((call) => call[1])
      .filter((event) => event.type === "assistant.text.delta");
    expect(textDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          delta: "放在三观下面 [[d:domain_1]]。",
        }),
      ]),
    );
  });

  test("persists plain text when catalog is present and no citation is used", async () => {
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
            assistantMessageEvent: { type: "text_delta", delta: "草稿" },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "草稿" }],
              provider: "openai",
              model: "gpt-4o",
              stopReason: "stop",
            },
          });
        }),
        getContextUsage: vi.fn(() => undefined),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const webContents = { isDestroyed: () => false, send: vi.fn() };

    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).sendMessage(
      {
        type: "message.send",
        sessionId: thread.id,
        text: "放在哪里",
        contextRefs: [{ type: "domain", id: "domain_1", title: "三观" }],
        modelSelection: { providerId: "openai", modelId: "gpt-4o" },
      },
      webContents as never,
    );

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    expect(events.find((event) => event.type === "assistant.turn")).toMatchObject({
      text: "草稿",
      blocks: [{ kind: "text", text: "草稿", state: "done" }],
    });
    expect(events.map((event) => event.type)).not.toContain("run.failed");
  });

  test("streams approval tool previews before persisting the executable proposal", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_create");
    hydratePiApprovalPayloadMock.mockResolvedValueOnce({
      title: "Final",
      body: "Final body",
    });
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
            assistantMessageEvent: {
              type: "toolcall_delta",
              contentIndex: 0,
              partial: {
                content: [
                  {
                    type: "toolCall",
                    id: "tool_1",
                    name: "understanding_create",
                    arguments: { title: "Draft", body: "Draft body" },
                  },
                ],
              },
            },
          });
          listener?.({
            type: "message_update",
            assistantMessageEvent: {
              type: "toolcall_end",
              toolCall: {
                type: "toolCall",
                id: "tool_1",
                name: "understanding_create",
                arguments: { title: "Final", body: "Final body" },
              },
            },
          });
          listener?.({
            type: "tool_execution_start",
            toolCallId: "tool_1",
            toolName: "understanding_create",
            args: { title: "Final", body: "Final body" },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [
                {
                  type: "toolCall",
                  id: "tool_1",
                  name: "understanding_create",
                  arguments: { title: "Final", body: "Final body" },
                },
              ],
              provider: "openai",
              model: "gpt-4o",
              stopReason: "toolUse",
            },
          });
        }),
        getContextUsage: vi.fn(() => undefined),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const webContents = { isDestroyed: () => false, send: vi.fn() };

    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
      }
    ).sendMessage(
      {
        type: "message.send",
        sessionId: thread.id,
        text: "创建一个 Understanding",
        modelSelection: { providerId: "openai", modelId: "gpt-4o" },
      },
      webContents as never,
    );

    const sentApprovals = webContents.send.mock.calls
      .map((call) => call[1])
      .filter((event) => event.type === "approval.requested");
    expect(sentApprovals).toEqual([
      expect.objectContaining({
        preview: true,
        payload: { title: "Draft", body: "Draft body" },
      }),
      expect.objectContaining({
        preview: true,
        payload: { title: "Final", body: "Final body" },
      }),
      expect.objectContaining({
        payload: { title: "Final", body: "Final body" },
      }),
    ]);
    expect(sentApprovals[2]).not.toHaveProperty("preview");

    const persistedApprovals = (await new AgentSessionLog(root).readEvents(thread.id)).filter(
      (event) => event.type === "approval.requested",
    );
    expect(persistedApprovals).toEqual([
      expect.objectContaining({
        toolCallId: "tool_1",
        payload: { title: "Final", body: "Final body" },
      }),
    ]);
    expect(persistedApprovals[0]).not.toHaveProperty("preview");
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
    let finishTextStream!: () => void;
    let textStarted!: () => void;
    const textStartedPromise = new Promise<void>((resolve) => {
      textStarted = resolve;
    });
    const textFinishedPromise = new Promise<void>((resolve) => {
      finishTextStream = resolve;
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
          textStarted();
          await textFinishedPromise;
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "。" },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "前半段回复。" }],
              provider: "openai",
              model: "gpt-4o",
              stopReason: "stop",
            },
          });
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
    await textStartedPromise;

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

    finishTextStream();
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
