import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModelRegistry, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { KnownProvider } from "@earendil-works/pi-ai/compat";
import {
  reduceAgentSession,
  type AgentSessionEvent,
  type AgentSessionFeedFrame,
  type AgentSessionProjection,
} from "@shared/agent";
import type { ResolvedAiModelConfig } from "../../config";
import {
  buildThreadTitleContext,
  createPiBashTool,
  createPiResourceLoader,
  expandDollarSkillInvocation,
  listGlobalAgentSkills,
  normalizeGeneratedThreadTitle,
  PI_BUILTIN_SKILL_NAMES,
  PI_BUILTIN_TOOL_NAMES,
  PiAgentHost,
} from "./pi-agent-host";
import { createCodexBrowserAuthInteraction, createPiModelRuntime } from "./pi-model-runtime";
import { AgentEntityCatalog } from "./agent-entity-catalog";
import { AgentSessionLog } from "./pi-session-log";
import { PI_WEB_ACCESS_TOOL_NAMES } from "./pi-web-access";
import { extractPiAssistantError } from "./pi-message";

const createAgentSessionMock = vi.hoisted(() => vi.fn());
const executePiApprovedToolMock = vi.hoisted(() => vi.fn());
const hydratePiApprovalPayloadMock = vi.hoisted(() =>
  vi.fn(async (_toolName: string, payload: Record<string, unknown>) => payload),
);
const getModelMock = vi.hoisted(() => vi.fn(() => ({ id: "model-test" })));
const isPiApprovalToolNameMock = vi.hoisted(() => vi.fn((_name: string) => false));
const piAuthPathMock = vi.hoisted(() => `/tmp/reflecta-pi-agent-host-${process.pid}-auth.json`);

async function recordSessionFrames(host: PiAgentHost, sessionId: string) {
  const frames: AgentSessionFeedFrame[] = [];
  const stop = await host.watchSession(sessionId, (frame) => frames.push(frame));
  return { frames, stop };
}

function stateFrames(frames: AgentSessionFeedFrame[]): AgentSessionProjection[] {
  return frames.flatMap((frame) => (frame.kind === "state" ? [frame.session] : []));
}

function approvalTransitions(frames: AgentSessionFeedFrame[]) {
  const transitions = stateFrames(frames).flatMap((session) =>
    session.messages.flatMap((message) =>
      (message.blocks ?? []).filter((block) => block.kind === "approval"),
    ),
  );
  return transitions.filter((block, index) => {
    if (index === 0) return true;
    const previous = transitions[index - 1];
    return JSON.stringify(block) !== JSON.stringify(previous);
  });
}

function mockAgentReply(manager: SessionManager, text: string) {
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
          assistantMessageEvent: { type: "text_delta", delta: text },
        });
        listener?.({
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text }],
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
}

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
  getAppConfigDir: () => "/tmp/reflecta-pi-agent-host-test-config",
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
  getPiAuthPath: () => piAuthPathMock,
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

const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-pi-agent-host-"));
  roots.push(root);
  return root;
}

function writeSkill(skillsDir: string, name: string, description = `${name} description`) {
  const skillDir = path.join(skillsDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
  );
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
  fs.rmSync(piAuthPathMock, { force: true });
});

describe("createPiModelRuntime", () => {
  test("makes an existing Codex login usable by the Agent and extensions", async () => {
    fs.writeFileSync(
      piAuthPathMock,
      JSON.stringify({
        "openai-codex": {
          type: "oauth",
          access: "codex-access-token",
          refresh: "codex-refresh-token",
          expires: 4_102_444_800_000,
          accountId: "account-test",
        },
      }),
    );
    const modelRuntime = await createPiModelRuntime(
      modelConfig({ providerId: "openai-codex", apiKey: "", authType: "codex" }),
    );

    const model = modelRuntime.getModels("openai-codex")[0];
    expect(model).toBeDefined();
    const auth = await new ModelRegistry(modelRuntime).getApiKeyAndHeaders(model!);
    expect(auth).toMatchObject({ ok: true, apiKey: "codex-access-token" });
  });

  test("uses configured API key without refreshing remote model catalogs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const modelRuntime = await createPiModelRuntime(
      modelConfig({ providerId: "opencode-go", apiKey: "opencode-key" }),
    );

    const model = modelRuntime.getModels("opencode-go")[0];
    expect(model).toBeDefined();
    const auth = await new ModelRegistry(modelRuntime).getApiKeyAndHeaders(model!);
    expect(auth).toMatchObject({ ok: true, apiKey: "opencode-key" });
  });

  test("opens the OpenAI authorization page for Codex subscription login", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const interaction = createCodexBrowserAuthInteraction(openExternal);

    await expect(
      interaction.prompt({
        type: "select",
        message: "Select login method",
        options: [
          { id: "browser", label: "Browser login" },
          { id: "device_code", label: "Device code" },
        ],
      }),
    ).resolves.toBe("browser");
    interaction.notify({ type: "auth_url", url: "https://auth.openai.com/authorize" });

    expect(openExternal).toHaveBeenCalledWith("https://auth.openai.com/authorize");
  });
});

describe("createPiResourceLoader", () => {
  test("loads Reflecta builtin skills and valid global Agent Skills only", async () => {
    const root = tempRoot();
    const agentDir = path.join(root, ".pi-agent");
    const globalSkillsDir = path.join(root, ".agents", "skills");
    writeSkill(globalSkillsDir, "explain-note", "Explain a note clearly");
    const loader = await createPiResourceLoader({
      cwd: root,
      agentDir,
      globalSkillsDir,
      settingsManager: SettingsManager.inMemory({}),
      onDangerousBashApproval: vi.fn().mockResolvedValue(true),
      getEntityCatalog: () => [],
    });

    expect(loader.getExtensions().extensions.map((extension) => extension.path)).toEqual([
      expect.stringMatching(/pi-web-access\/index\.ts$/),
      "<inline:reflecta-web-access-policy>",
      "<inline:reflecta-bash-permission-gate>",
      "<inline:reflecta-entity-catalog-context>",
      "<inline:reflecta-context-compaction>",
    ]);
    const skills = loader.getSkills().skills;
    expect(skills.map((skill) => skill.name)).toEqual([...PI_BUILTIN_SKILL_NAMES, "explain-note"]);
    for (const skillName of PI_BUILTIN_SKILL_NAMES) {
      expect(skills).toContainEqual(
        expect.objectContaining({
          name: skillName,
          filePath: path.join(agentDir, "builtin-skills", skillName, "SKILL.md"),
        }),
      );
    }

    const understandingResource = skills.find((skill) => skill.name === "reflecta-understanding");
    expect(understandingResource?.description).toContain("understanding_*");
    expect(understandingResource?.description).not.toContain("context_*");
    const understandingSkillPath = understandingResource?.filePath;
    expect(understandingSkillPath).toBeDefined();
    const understandingSkill = fs.readFileSync(understandingSkillPath!, "utf8");
    expect(understandingSkill).toContain("# Reflecta Understanding");
    expect(understandingSkill).toContain("命题保真");
    expect(understandingSkill).toContain("心智形状保真");
    expect(understandingSkill).toContain("## Principle 5：Case 必须解释一个具体难点，否则不加");
    expect(understandingSkill).not.toContain("## 起草 Context");
    expect(understandingSkill).not.toContain("## Context 怎么写");
    expect(understandingSkill).not.toContain("Context 承载某个 Understanding 的具体来源和场景");

    const contextResource = skills.find((skill) => skill.name === "reflecta-context");
    expect(contextResource?.description).toContain("context_*");
    expect(contextResource?.description).not.toContain("understanding_*");
    const contextSkillPath = contextResource?.filePath;
    expect(contextSkillPath).toBeDefined();
    const contextSkill = fs.readFileSync(contextSkillPath!, "utf8");
    expect(contextSkill).toContain("Context 承载某个 Understanding 的具体来源和场景");
    expect(contextSkill).toContain("保留足够细节，不要为了简洁省略关键信息");
    expect(contextSkill).toContain("Context 一定要具体、详细、丰富");
    expect(contextSkill).not.toContain("尚未解决的问题、反例和不确定性");
    expect(contextSkill).not.toContain("完整会议纪要或材料摘要");

    expect(loader.getPrompts().prompts).toEqual([]);
    expect(loader.getThemes().themes).toEqual([]);
    expect(loader.getAgentsFiles().agentsFiles).toEqual([]);
    expect(loader.getSystemPrompt()).toContain("内置 skill `reflecta-understanding`");
    expect(loader.getSystemPrompt()).toContain("内置 skill `reflecta-context`");
    expect(loader.getSystemPrompt()).not.toContain("reflecta-understanding-context");
  });
});

describe("global Agent Skills", () => {
  test("lists global skills without Reflecta builtins and expands only a leading known $ skill", () => {
    const root = tempRoot();
    const globalSkillsDir = path.join(root, ".agents", "skills");
    writeSkill(globalSkillsDir, "explain-note", "Explain a note clearly");
    writeSkill(globalSkillsDir, "reflecta-context", "Do not expose the builtin skill");

    expect(listGlobalAgentSkills(globalSkillsDir)).toEqual([
      { name: "explain-note", description: "Explain a note clearly" },
    ]);
    expect(expandDollarSkillInvocation("  $explain-note this", ["explain-note"])).toBe(
      "/skill:explain-note this",
    );
    expect(expandDollarSkillInvocation("prefix $explain-note", ["explain-note"])).toBe(
      "prefix $explain-note",
    );
    expect(expandDollarSkillInvocation("$missing this", ["explain-note"])).toBe("$missing this");
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
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);

    await host.sendAgentCommand({
      type: "context.compact",
      sessionId: thread.id,
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

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
    expect(stateFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activeCompaction: expect.objectContaining({ reason: "manual" }),
        }),
        expect.objectContaining({
          activeCompaction: null,
          contextCompactions: [
            expect.objectContaining({ summary: "## 当前意图\n继续验证上下文压缩" }),
          ],
        }),
      ]),
    );
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
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);
    await expect(
      host.sendAgentCommand({ type: "context.compact", sessionId: thread.id }),
    ).rejects.toThrow("当前对话还不需要压缩");

    await expect(new AgentSessionLog(root).readEvents(thread.id)).resolves.toEqual([userEvent]);
    expect(stateFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activeCompaction: expect.objectContaining({ reason: "manual" }),
        }),
        expect.objectContaining({
          activeCompaction: null,
          compactionError: "当前对话还不需要压缩",
        }),
      ]),
    );
  });

  test("rejects manual compaction while the conversation is already running", async () => {
    const host = new PiAgentHost(tempRoot());
    (
      host as unknown as {
        activeRuns: Map<string, unknown>;
      }
    ).activeRuns.set("session_busy", {});

    await expect(
      host.sendAgentCommand({ type: "context.compact", sessionId: "session_busy" }),
    ).rejects.toThrow("当前对话正在处理中，请稍后再压缩上下文");
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });

  test("preserves Pi assistant error messages instead of reporting an empty response", () => {
    expect(
      extractPiAssistantError({
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
    mockAgentReply(manager, "操作已经完成。");
    await (
      new PiAgentHost(root) as unknown as {
        resolveToolApproval: (command: unknown) => Promise<void>;
      }
    ).resolveToolApproval({
      type: "tool.approve",
      sessionId: thread.id,
      approvalId: "approval_tool_1",
    });

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    expect(events.map((event) => event.type)).toEqual([
      "approval.requested",
      "approval.resolved",
      "tool.execution.started",
      "entity.catalog.updated",
      "tool.execution.completed",
      "assistant.turn",
      "run.started",
      "assistant.turn",
      "run.completed",
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
    mockAgentReply(manager, "操作执行失败。");
    await (
      new PiAgentHost(root) as unknown as {
        resolveToolApproval: (command: unknown) => Promise<void>;
      }
    ).resolveToolApproval({
      type: "tool.approve",
      sessionId: thread.id,
      approvalId: "approval_tool_1",
    });

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    expect(events.map((event) => event.type)).toEqual([
      "approval.requested",
      "approval.resolved",
      "tool.execution.started",
      "tool.execution.failed",
      "assistant.turn",
      "run.started",
      "assistant.turn",
      "run.completed",
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
    const globalSkillsDir = path.join(root, ".agents", "skills");
    writeSkill(globalSkillsDir, "explain-note", "Explain a note clearly");
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
    await (
      new PiAgentHost(root, undefined, globalSkillsDir) as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "$explain-note 请解释这个 context",
      contextRefs: [{ type: "context", id: "ctx_1", title: "一次复盘" }],
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

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
    expect(promptCalls[0]).toMatch(/^\/skill:explain-note 请解释这个 context/);
    expect(promptCalls[0]).not.toContain("<reflecta_entities");
    expect(promptCalls[0]).not.toContain("sourceId");
    expect(newEvents.find((event) => event.type === "user.message")).toMatchObject({
      text: "$explain-note 请解释这个 context",
    });
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
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);
    await (
      host as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "统计上下文",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

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
    expect(stateFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "assistant", text: "完成" }),
          ]),
        }),
      ]),
    );
  });

  test("projects web access result errors as failed tools", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("网页读取失败");
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
            type: "tool_execution_start",
            toolCallId: "tool_fetch",
            toolName: "fetch_content",
            args: { url: "https://example.com" },
          });
          listener?.({
            type: "tool_execution_end",
            toolCallId: "tool_fetch",
            toolName: "fetch_content",
            result: {
              content: [{ type: "text", text: "Error: Blocked internal address" }],
              details: { error: "Blocked internal address" },
            },
            isError: false,
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [
                {
                  type: "toolCall",
                  id: "tool_fetch",
                  name: "fetch_content",
                  arguments: { url: "https://example.com" },
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

    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "读取网页",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    expect(
      (await log.readEvents(thread.id)).find((event) => event.type === "assistant.turn"),
    ).toMatchObject({
      blocks: [
        {
          kind: "tool",
          toolCallId: "tool_fetch",
          toolName: "fetch_content",
          state: "failed",
          error: "Blocked internal address",
        },
      ],
    });
  });

  test("keeps an in-run compaction in turn order and shows its reduced usage", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("自动压缩");
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
        model: { contextWindow: 272_000 },
        subscribe: (next: (event: unknown) => void) => {
          listener = next;
          return () => {};
        },
        prompt: vi.fn(async () => {
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "压缩前" },
          });
          listener?.({ type: "compaction_start", reason: "overflow" });
          listener?.({
            type: "compaction_end",
            reason: "overflow",
            result: {
              summary: "保留当前进度",
              firstKeptEntryId: "entry_kept",
              tokensBefore: 218_728,
              estimatedTokensAfter: 1_569,
            },
          });
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "压缩后" },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "压缩前压缩后" }],
              provider: "openai",
              model: "gpt-5.6-sol",
              stopReason: "stop",
            },
          });
        }),
        getContextUsage: vi.fn(() => ({
          tokens: null,
          contextWindow: 272_000,
          percent: null,
        })),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "继续处理",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    const events = await new AgentSessionLog(root).readEvents(thread.id);
    const turn = events.find((event) => event.type === "assistant.turn");
    expect(events.find((event) => event.type === "context.compacted")).toMatchObject({
      messageId: turn?.messageId,
    });
    expect(turn?.blocks.map((block) => block.kind)).toEqual(["text", "context-compaction", "text"]);

    const state = reduceAgentSession(events);
    expect(state.contextCompactions).toEqual([]);
    expect(state.messages.at(-1)?.contextUsage).toEqual({
      tokens: 1_569,
      contextWindow: 272_000,
      percent: (1_569 / 272_000) * 100,
    });
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
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);

    await (
      host as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "放在哪个 domain",
      contextRefs: [{ type: "domain", id: "domain_1", title: "三观" }],
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

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
    expect(stateFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "assistant",
              text: "放在三观下面 [[d:domain_1]]。",
            }),
          ]),
        }),
      ]),
    );
  });

  test("keeps the regenerated user question visible while the model restarts", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("重新生成对话");
    const manager = await log.openSession(thread.id);
    const events: AgentSessionEvent[] = [
      {
        id: "evt_1",
        sessionId: thread.id,
        runId: "run_1",
        type: "run.started",
        createdAt: "2026-08-08T00:00:00.000Z",
      },
      {
        id: "evt_2",
        sessionId: thread.id,
        runId: "run_1",
        type: "user.message",
        messageId: "user_1",
        text: "第一个问题",
        createdAt: "2026-08-08T00:00:01.000Z",
      },
      {
        id: "evt_3",
        sessionId: thread.id,
        runId: "run_1",
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "第一个回答",
        blocks: [{ kind: "text", text: "第一个回答", createdAt: "2026-08-08T00:00:02.000Z" }],
        createdAt: "2026-08-08T00:00:02.000Z",
      },
      {
        id: "evt_4",
        sessionId: thread.id,
        runId: "run_1",
        type: "run.completed",
        createdAt: "2026-08-08T00:00:03.000Z",
      },
      {
        id: "evt_5",
        sessionId: thread.id,
        runId: "run_2",
        type: "run.started",
        createdAt: "2026-08-08T00:00:04.000Z",
      },
      {
        id: "evt_6",
        sessionId: thread.id,
        runId: "run_2",
        type: "user.message",
        messageId: "user_2",
        text: "第二个问题",
        createdAt: "2026-08-08T00:00:05.000Z",
      },
      {
        id: "evt_7",
        sessionId: thread.id,
        runId: "run_2",
        type: "assistant.turn",
        messageId: "assistant_2",
        text: "第二个回答",
        blocks: [{ kind: "text", text: "第二个回答", createdAt: "2026-08-08T00:00:06.000Z" }],
        createdAt: "2026-08-08T00:00:06.000Z",
      },
      {
        id: "evt_8",
        sessionId: thread.id,
        runId: "run_2",
        type: "run.completed",
        createdAt: "2026-08-08T00:00:07.000Z",
      },
    ];
    for (const event of events) log.appendEvent(manager, event);

    // 挂起 createAgentSession，模拟模型运行时尚未就绪的窗口：
    // 重新生成期间，最新投影必须始终保留被重新生成的问题。
    let resolveAgentSession!: (session: unknown) => void;
    createAgentSessionMock.mockReturnValueOnce(
      new Promise((resolve) => (resolveAgentSession = resolve)),
    );
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);

    host.sendAgentCommand({
      type: "message.send",
      sessionId: thread.id,
      text: "第二个问题",
      messageId: "user_2",
    });

    await vi.waitFor(() => {
      const latest = stateFrames(frames).at(-1);
      expect(latest?.status).toBe("running");
      expect(latest?.messages.some((message) => message.id === "user_2")).toBe(true);
    });
    expect(
      stateFrames(frames)
        .at(-1)
        ?.messages.map((message) => message.id),
    ).toEqual(["user_1", "assistant_1", "user_2"]);

    let listener: ((event: unknown) => void) | undefined;
    resolveAgentSession({
      session: {
        sessionManager: manager,
        subscribe: (next: (event: unknown) => void) => {
          listener = next;
          return () => {};
        },
        prompt: vi.fn(async () => {
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "新的回答" },
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "新的回答" }],
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
    await vi.waitFor(() => {
      expect(stateFrames(frames).at(-1)?.status).toBe("idle");
    });

    const finalSession = stateFrames(frames).at(-1);
    expect(finalSession?.messages.map((message) => message.id)).toEqual([
      "user_1",
      "assistant_1",
      "user_2",
      expect.any(String),
    ]);
    expect(finalSession?.messages[3]).toMatchObject({
      role: "assistant",
      text: "新的回答",
    });
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
    await (
      new PiAgentHost(root) as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "放在哪里",
      contextRefs: [{ type: "domain", id: "domain_1", title: "三观" }],
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

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
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);

    await (
      host as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "创建一个 Understanding",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    const sentApprovals = approvalTransitions(frames);
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
    expect(sentApprovals[2]?.preview).toBeFalsy();

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

  test("hydrates update previews before tool arguments finish streaming", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_update");
    const hydrationResolvers: Array<() => void> = [];
    hydratePiApprovalPayloadMock.mockImplementation(
      (_toolName: string, payload: Record<string, unknown>) =>
        new Promise<Record<string, unknown>>((resolve) => {
          hydrationResolvers.push(() =>
            resolve({
              ...payload,
              before: {
                title: "Existing title",
                body: "Existing body",
                domainIds: ["domain_1"],
              },
            }),
          );
        }),
    );
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
                    name: "understanding_update",
                    arguments: { understandingId: "under" },
                  },
                ],
              },
            },
          });
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
                    name: "understanding_update",
                    arguments: {
                      understandingId: "understanding_1",
                      after: { body: "Draft" },
                    },
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
                name: "understanding_update",
                arguments: {
                  understandingId: "understanding_1",
                  after: { body: "Final body" },
                },
              },
            },
          });
          listener?.({
            type: "tool_execution_start",
            toolCallId: "tool_1",
            toolName: "understanding_update",
            args: {
              understandingId: "understanding_1",
              after: { body: "Final body" },
            },
          });
          expect(hydratePiApprovalPayloadMock).toHaveBeenCalledTimes(1);
          hydrationResolvers.forEach((resolve) => resolve());
          await Promise.resolve();
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [
                {
                  type: "toolCall",
                  id: "tool_1",
                  name: "understanding_update",
                  arguments: {
                    understandingId: "understanding_1",
                    after: { body: "Final body" },
                  },
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
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);

    await (
      host as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "更新这个 Understanding",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    expect(hydratePiApprovalPayloadMock).toHaveBeenCalledTimes(1);
    const previewApprovals = approvalTransitions(frames).filter((block) => block.preview);
    expect(previewApprovals).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          understandingId: "understanding_1",
          before: {
            title: "Existing title",
            body: "Existing body",
            domainIds: ["domain_1"],
          },
        }),
      }),
    );
  });

  test("hydrates a completed update preview when the entity id is the last property", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_update");
    hydratePiApprovalPayloadMock.mockImplementation(
      async (_toolName: string, payload: Record<string, unknown>) => ({
        ...payload,
        before: {
          title: "Existing title",
          body: "Existing body",
          domainIds: ["domain_1"],
        },
      }),
    );
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
    const finalArguments = {
      after: { body: "Final body" },
      before: { body: "Model-supplied body" },
      understandingId: "understanding_1",
    };
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
              type: "toolcall_end",
              toolCall: {
                type: "toolCall",
                id: "tool_1",
                name: "understanding_update",
                arguments: finalArguments,
              },
            },
          });
          listener?.({
            type: "tool_execution_start",
            toolCallId: "tool_1",
            toolName: "understanding_update",
            args: finalArguments,
          });
          listener?.({
            type: "message_end",
            message: {
              role: "assistant",
              content: [
                {
                  type: "toolCall",
                  id: "tool_1",
                  name: "understanding_update",
                  arguments: finalArguments,
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
    const host = new PiAgentHost(root);
    const { frames } = await recordSessionFrames(host, thread.id);

    await (
      host as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "更新这个 Understanding",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    const approvals = approvalTransitions(frames);
    expect(approvals).toHaveLength(2);
    expect(approvals.map((event) => event.preview)).toEqual([true, undefined]);
    expect(approvals.map((event) => (event.payload as { before: unknown }).before)).toEqual([
      {
        title: "Existing title",
        body: "Existing body",
        domainIds: ["domain_1"],
      },
      {
        title: "Existing title",
        body: "Existing body",
        domainIds: ["domain_1"],
      },
    ]);
  });

  test("restores the complete turn while an approval waits across an app restart", async () => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_update");
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
    const promptFinished = new Promise<void>((resolve) => (finishPrompt = resolve));
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
            assistantMessageEvent: { type: "thinking_delta", delta: "先检查已有内容。" },
          });
          listener?.({
            type: "tool_execution_start",
            toolCallId: "read_1",
            toolName: "understanding_get",
            args: { understandingId: "understanding_1" },
          });
          listener?.({
            type: "tool_execution_end",
            toolCallId: "read_1",
            toolName: "understanding_get",
            result: { content: [{ type: "text", text: "旧内容" }] },
            isError: false,
          });
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "我建议这样修改。" },
          });
          listener?.({
            type: "tool_execution_start",
            toolCallId: "write_1",
            toolName: "understanding_update",
            args: { understandingId: "understanding_1", after: { body: "新内容" } },
          });
          await promptFinished;
        }),
        getContextUsage: vi.fn(() => undefined),
        dispose: vi.fn(),
        abort: vi.fn(),
      },
    });
    const originalHost = new PiAgentHost(root);
    const sendPromise = (
      originalHost as unknown as { sendMessage: (command: unknown) => Promise<void> }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "更新这个 Understanding",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    await vi.waitFor(async () => {
      await expect(log.readEvents(thread.id)).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "approval.requested" })]),
      );
    });

    try {
      const restored = await new PiAgentHost(root).readSessionProjection(thread.id);
      const assistant = restored.messages.find((message) => message.role === "assistant");

      expect(restored).toMatchObject({ status: "waiting", activeRunId: null });
      expect(assistant?.blocks?.map((block) => block.kind)).toEqual([
        "reasoning",
        "tool",
        "text",
        "approval",
      ]);
    } finally {
      finishPrompt();
      await sendPromise;
    }
  });

  test.each([
    { approved: true, expectedReply: "已经按你的确认完成。" },
    { approved: false, expectedReply: "已经按你的决定取消。" },
    { approved: true, expectedReply: "危险命令已经执行完成。", bash: true },
  ])("continues automatically after a restored approval is decided", async (decision) => {
    isPiApprovalToolNameMock.mockImplementation((name) => name === "understanding_update");
    executePiApprovedToolMock.mockResolvedValue({
      resultRefType: "understanding",
      resultRefId: "understanding_1",
    });
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const thread = log.createSession("新对话");
    const manager = await log.openSession(thread.id);
    const bashMarker = path.join(root, "restored-bash.txt");
    const toolName = decision.bash ? "bash" : "understanding_update";
    const toolPayload = decision.bash
      ? { command: `printf restored > "${bashMarker}"` }
      : { understandingId: "understanding_1", after: { body: "新内容" } };
    manager.appendMessage({
      role: "user",
      content: [{ type: "text", text: "更新这个 Understanding" }],
      timestamp: Date.now(),
    });
    manager.appendMessage({
      role: "assistant",
      content: [{ type: "toolCall", id: "tool_1", name: toolName, arguments: toolPayload }],
      api: "openai-completions",
      provider: "openai",
      model: "gpt-4o",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "toolUse",
      timestamp: Date.now(),
    });
    const waitingEvents: AgentSessionEvent[] = [
      {
        id: "evt_run",
        sessionId: thread.id,
        runId: "run_1",
        type: "run.started",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
      {
        id: "evt_user",
        sessionId: thread.id,
        runId: "run_1",
        type: "user.message",
        messageId: "user_1",
        text: "更新这个 Understanding",
        createdAt: "2026-06-23T00:00:01.000Z",
      },
      {
        id: "evt_checkpoint",
        sessionId: thread.id,
        runId: "run_1",
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "我建议这样修改。",
        blocks: [
          {
            kind: "text",
            text: "我建议这样修改。",
            state: "done",
            createdAt: "2026-06-23T00:00:02.000Z",
          },
        ],
        createdAt: "2026-06-23T00:00:02.000Z",
      },
      {
        id: "evt_approval",
        sessionId: thread.id,
        runId: "run_1",
        type: "approval.requested",
        messageId: "assistant_1",
        approvalId: "approval_tool_1",
        toolCallId: "tool_1",
        toolName,
        title: decision.bash ? "确认危险 Bash" : "候选修改 Understanding",
        payload: toolPayload,
        createdAt: "2026-06-23T00:00:03.000Z",
      },
    ];
    for (const event of waitingEvents) log.appendEvent(manager, event);

    mockAgentReply(manager, decision.expectedReply);
    const restoredHost = new PiAgentHost(root);

    await restoredHost.sendAgentCommand(
      decision.approved
        ? {
            type: "tool.approve",
            sessionId: thread.id,
            approvalId: "approval_tool_1",
          }
        : {
            type: "tool.reject",
            sessionId: thread.id,
            approvalId: "approval_tool_1",
          },
    );

    const restored = await restoredHost.readSessionProjection(thread.id);
    expect(restored.status).toBe("idle");
    expect(restored.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(restored.messages.at(-1)).toMatchObject({
      role: "assistant",
      text: decision.expectedReply,
    });
    expect(
      (await log.openSession(thread.id))
        .getBranch()
        .some(
          (entry) =>
            entry.type === "message" &&
            entry.message.role === "toolResult" &&
            entry.message.toolCallId === "tool_1",
        ),
    ).toBe(true);
    expect(executePiApprovedToolMock).toHaveBeenCalledTimes(
      decision.approved && !decision.bash ? 1 : 0,
    );
    if (decision.bash) expect(fs.readFileSync(bashMarker, "utf8")).toBe("restored");
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
    const host = new PiAgentHost(root);

    const sendPromise = (
      host as unknown as {
        sendMessage: (command: unknown) => Promise<void>;
      }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "开始流式回复",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });
    await textStartedPromise;

    const restored = await host.readSessionProjection(thread.id);
    const restoredTurn = restored.messages.find((message) => message.role === "assistant");

    expect(restoredTurn).toEqual(
      expect.objectContaining({
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

  test("persists the visible partial response when a run is cancelled", async () => {
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
    let textStarted!: () => void;
    const promptFinished = new Promise<void>((resolve) => (finishPrompt = resolve));
    const textStartedPromise = new Promise<void>((resolve) => (textStarted = resolve));
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
            assistantMessageEvent: { type: "text_delta", delta: "已经生成的部分" },
          });
          textStarted();
          await promptFinished;
        }),
        getContextUsage: vi.fn(() => undefined),
        dispose: vi.fn(),
        abort: vi.fn(async () => {
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "取消后的迟到内容" },
          });
          finishPrompt();
        }),
      },
    });
    const host = new PiAgentHost(root);
    const sendPromise = (
      host as unknown as { sendMessage: (command: unknown) => Promise<void> }
    ).sendMessage({
      type: "message.send",
      sessionId: thread.id,
      text: "开始流式回复",
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });
    await textStartedPromise;

    await host.sendAgentCommand({ type: "run.cancel", sessionId: thread.id });
    await sendPromise;

    const events = await log.readEvents(thread.id);
    expect(events.slice(-2)).toMatchObject([
      { type: "assistant.turn", text: "已经生成的部分" },
      { type: "run.cancelled" },
    ]);
    await expect(host.readSessionProjection(thread.id)).resolves.toMatchObject({
      status: "cancelled",
      messages: [
        { role: "user", text: "开始流式回复" },
        { role: "assistant", text: "已经生成的部分" },
      ],
    });
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

    const restored = await new PiAgentHost(root).readSessionProjection(session.id);

    expect(restored).toMatchObject({ status: "cancelled", activeRunId: null });
    await expect(new AgentSessionLog(root).readEvents(session.id)).resolves.toMatchObject([
      { type: "run.started" },
      { type: "user.message" },
      { type: "run.cancelled" },
    ]);
  });
});
