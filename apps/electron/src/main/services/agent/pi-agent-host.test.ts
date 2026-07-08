import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthStorage } from "@earendil-works/pi-coding-agent";
import type { AgentSessionEvent } from "@shared/agent";
import type { ResolvedAiModelConfig } from "../../config";
import {
  AGENT_EVENT_CHANNEL,
  buildThreadTitleContext,
  configurePiRuntimeAuth,
  createPiResourceLoader,
  extractAssistantError,
  loadAgentSystemPrompt,
  normalizeGeneratedThreadTitle,
  PiAgentHost,
} from "./pi-agent-host";
import { AgentEntityCatalog } from "./agent-entity-catalog";
import { AgentSessionLog } from "./pi-session-log";

const createAgentSessionMock = vi.hoisted(() => vi.fn());
const executePiApprovedToolMock = vi.hoisted(() => vi.fn());
const hydratePiApprovalPayloadMock = vi.hoisted(() =>
  vi.fn(async (_toolName: string, payload: Record<string, unknown>) => payload),
);
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
  hydratePiApprovalPayload: hydratePiApprovalPayloadMock,
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

  test("collects approved mutation outputs in the entity catalog", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_create");
    executePiApprovedToolMock.mockResolvedValue({
      resultRefType: "understanding",
      resultRefId: "understanding_1",
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
    });
    expect(catalog.drainUpdates()).toEqual([
      {
        key: "understanding:understanding_1",
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
        origin: { kind: "user_context", messageId: "user_1" },
      }),
    );
    expect(promptCalls[0]).toContain("Context: 一次复盘; id=ctx_1");
    expect(promptCalls[0]).not.toContain("[[");
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

  test("streams and persists plain text with numbered citation sources", async () => {
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
              delta: "放在三观下面 [1]。",
            },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "放在三观下面 [1]。" }],
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
      text: "放在三观下面 [1]。",
      citationSources: [
        {
          index: 1,
          entity: { type: "domain", id: "domain_1", title: "三观" },
          origin: { kind: "user_context", messageId: expect.any(String) },
        },
      ],
      blocks: [
        {
          kind: "text",
          text: "放在三观下面 [1]。",
        },
      ],
    });
    const textDeltas = webContents.send.mock.calls
      .map((call) => call[1])
      .filter((event) => event.type === "assistant.text.delta");
    expect(textDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          delta: "放在三观下面 [1]。",
          citationSources: [
            expect.objectContaining({
              index: 1,
              entity: { type: "domain", id: "domain_1", title: "三观" },
            }),
          ],
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
      citationSources: [],
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
