import fs from "node:fs";
import path from "node:path";
import type { WebContents } from "electron";
import {
  completeSimple,
  getModel,
  type Api,
  type Context,
  type Model,
} from "@earendil-works/pi-ai/compat";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { nanoid } from "nanoid";
import { reduceAgentSession } from "@shared/agent";
import type {
  AgentCommand,
  AgentContextUsage,
  AgentContextRef,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentApprovalRequested,
  AgentReducedAssistantBlock,
  AgentEvent,
  AgentLiveEvent,
  AgentSessionEvent,
  AgentSessionSummary,
  AgentToolExecutionError,
  AgentUsage,
} from "@shared/agent";
import {
  getActiveAgentReasoningLevel,
  getAiModelConfig,
  getContentStorageRoot,
  getTitleGenerationAiModelConfig,
  type AiModelSelection,
  type ResolvedAiModelConfig,
} from "../../config";
import { agentLog } from "../../logger";
import { AgentRunAccumulator } from "./agent-run-accumulator";
import { AgentEntityCatalog } from "./agent-entity-catalog";
import { AgentSessionLog } from "./pi-session-log";
import { formatAgentError } from "./error";
import { buildPiPromptText } from "./pi-prompt";
import { getCodexCredentials } from "./codex-auth";
import agentSystemPrompt from "./agent-system-prompt.md?raw";
import { formatEntityRecordsForPrompt } from "./agent-citations";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";
import {
  approvalTitleForTool,
  createPiWriteTools,
  executePiApprovedTool,
  hydratePiApprovalPayload,
  isPiApprovalToolName,
  PI_APPROVAL_TOOL_NAMES,
  rejectedToolResult,
  type PiApprovedToolOutput,
  type PiApprovalToolName,
} from "./pi-write-tools";
import {
  createPiBashPermissionGate,
  dangerousBashRuleLabels,
  type DangerousBashApprovalHandler,
} from "./pi-bash-permission-gate";

export const AGENT_EVENT_CHANNEL = "agent:event";

type ActivePiRun = {
  runId: string;
  assistantMessageId: string;
  session: AgentSession;
  accumulator: AgentRunAccumulator;
  pendingApprovals: Map<string, PendingApproval>;
  entityCatalog: AgentEntityCatalog;
};

type MutationPendingApproval = {
  kind: "mutation";
  resolve: (output: PiApprovedToolOutput | ReturnType<typeof rejectedToolResult>) => void;
  reject: (error: Error) => void;
};

type BashGatePendingApproval = {
  kind: "bash_gate";
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
};

type PendingApproval = MutationPendingApproval | BashGatePendingApproval;

export const PI_BUILTIN_TOOL_NAMES = ["read", "bash", "edit", "write"] as const;

export function loadAgentSystemPrompt(): string {
  return agentSystemPrompt.trim();
}

export async function createPiResourceLoader(input: {
  cwd: string;
  agentDir: string;
  settingsManager: SettingsManager;
  onDangerousBashApproval: DangerousBashApprovalHandler;
}): Promise<DefaultResourceLoader> {
  const loader = new DefaultResourceLoader({
    cwd: input.cwd,
    agentDir: input.agentDir,
    settingsManager: input.settingsManager,
    systemPrompt: loadAgentSystemPrompt(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    extensionFactories: [createPiBashPermissionGate(input.onDangerousBashApproval)],
  });
  await loader.reload();
  return loader;
}

function resolvePiModel(providerId: string, modelId: string): Model<Api> {
  const model = (getModel as (provider: string, modelId: string) => Model<Api> | undefined)(
    providerId,
    modelId,
  );
  if (!model) throw new Error(`Pi model not found: ${providerId}/${modelId}`);
  return model;
}

function thinkingLevelFor(level: AgentReasoningLevel | undefined) {
  return level ?? "off";
}

type AssistantTurnMetadata = {
  usage?: AgentUsage;
  contextUsage?: AgentContextUsage;
  model?: AgentModelSelection;
  stopReason?: string;
};

function numberField(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

function extractUsage(value: unknown): AgentUsage | undefined {
  if (!isRecord(value)) return undefined;
  const input = numberField(value, "input");
  const output = numberField(value, "output");
  const cacheRead = numberField(value, "cacheRead");
  const cacheWrite = numberField(value, "cacheWrite");
  const totalTokens = numberField(value, "totalTokens");
  if (
    input === undefined ||
    output === undefined ||
    cacheRead === undefined ||
    cacheWrite === undefined ||
    totalTokens === undefined
  ) {
    return undefined;
  }

  const cost = isRecord(value.cost)
    ? {
        input: numberField(value.cost, "input"),
        output: numberField(value.cost, "output"),
        cacheRead: numberField(value.cost, "cacheRead"),
        cacheWrite: numberField(value.cost, "cacheWrite"),
        total: numberField(value.cost, "total"),
      }
    : undefined;
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    totalTokens,
    ...(cost &&
    cost.input !== undefined &&
    cost.output !== undefined &&
    cost.cacheRead !== undefined &&
    cost.cacheWrite !== undefined &&
    cost.total !== undefined
      ? { cost: cost as AgentUsage["cost"] }
      : {}),
  };
}

function extractAssistantTurnMetadata(message: unknown): AssistantTurnMetadata | undefined {
  if (!isRecord(message) || message.role !== "assistant") return undefined;
  const usage = extractUsage(message.usage);
  const providerId = typeof message.provider === "string" ? message.provider : undefined;
  const modelId = typeof message.model === "string" ? message.model : undefined;
  const stopReason = typeof message.stopReason === "string" ? message.stopReason : undefined;
  if (!usage && !(providerId && modelId) && !stopReason) return undefined;
  return {
    ...(usage ? { usage } : {}),
    ...(providerId && modelId ? { model: { providerId, modelId } } : {}),
    ...(stopReason ? { stopReason } : {}),
  };
}

function extractAssistantText(message: unknown): string {
  if (
    !message ||
    typeof message !== "object" ||
    !("role" in message) ||
    message.role !== "assistant" ||
    !("content" in message) ||
    !Array.isArray(message.content)
  ) {
    return "";
  }

  return message.content
    .map((part) =>
      part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part
        ? String(part.text)
        : "",
    )
    .join("");
}

export function extractAssistantError(message: unknown): string {
  if (!isRecord(message) || message.role !== "assistant" || message.stopReason !== "error") {
    return "";
  }
  return typeof message.errorMessage === "string" ? message.errorMessage : "";
}

const TITLE_GENERATION_SYSTEM_PROMPT =
  "你是 Reflecta 的对话标题生成器。根据用户与 Agent 的对话内容生成一个简短、具体、可回看的标题。只输出标题本身。";
const TITLE_GENERATION_MAX_SOURCE_LENGTH = 8000;
const TITLE_GENERATION_MAX_TITLE_LENGTH = 40;

function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function fallbackGeneratedThreadTitle(events: AgentSessionEvent[]): string {
  const firstUserText = reduceAgentSession(events)
    .messages.find((message) => message.role === "user")
    ?.text.trim();
  return firstUserText ? truncateText(firstUserText, TITLE_GENERATION_MAX_TITLE_LENGTH) : "";
}

export function normalizeGeneratedThreadTitle(input: string, fallback = "新对话"): string {
  const firstLine = input
    .trim()
    .replace(/^```(?:\w+)?\s*/u, "")
    .replace(/```$/u, "")
    .split(/\r?\n/u)
    .find((line) => line.trim());
  const title = (firstLine ?? "")
    .trim()
    .replace(/^#+\s*/u, "")
    .replace(/^标题\s*[:：]\s*/iu, "")
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/gu, "")
    .trim();
  return truncateText(title || fallback, TITLE_GENERATION_MAX_TITLE_LENGTH);
}

export function buildThreadTitleContext(events: AgentSessionEvent[]): Context | null {
  const source = reduceAgentSession(events)
    .messages.flatMap((message) => {
      const text = message.text.trim();
      if (!text) return [];
      return `${message.role === "user" ? "用户" : "Agent"}: ${text}`;
    })
    .join("\n\n")
    .trim();

  if (!source) return null;

  return {
    systemPrompt: TITLE_GENERATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          "请为下面这段对话生成标题。",
          "",
          "要求：",
          "- 只输出标题，不要解释",
          "- 不要使用引号、编号或 Markdown",
          "- 标题要体现对话的具体主题",
          "- 不超过 20 个汉字或 40 个英文字符",
          "",
          "对话内容：",
          truncateText(source, TITLE_GENERATION_MAX_SOURCE_LENGTH),
        ].join("\n"),
        timestamp: Date.now(),
      },
    ],
  };
}

export async function generateAgentThreadTitle(
  events: AgentSessionEvent[],
  contentStorageRoot = getContentStorageRoot(),
): Promise<string> {
  const sessionId = events[0]?.sessionId ?? "session";
  const context = buildThreadTitleContext(events);
  if (!context) {
    agentLog.warn("title.generate.noContext", { sessionId, eventCount: events.length });
    return "";
  }

  const modelConfig = getTitleGenerationAiModelConfig();
  agentLog.info("title.generate.request", {
    sessionId,
    providerId: modelConfig.provider.id,
    modelId: modelConfig.model.id,
    eventCount: events.length,
    messageCount: reduceAgentSession(events).messages.length,
    promptLength: context.messages[0]?.content.length ?? 0,
    maxTokens: 256,
  });
  const agentDir = path.join(contentStorageRoot, ".pi-agent");
  fs.mkdirSync(agentDir, { recursive: true });
  const authStorage = AuthStorage.create(path.join(agentDir, "auth.json"));
  await configurePiRuntimeAuth(authStorage, modelConfig);
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const model = resolvePiModel(modelConfig.provider.id, modelConfig.model.id);
  const auth = await modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);

  const response = await completeSimple(model, context, {
    apiKey: auth.apiKey,
    env: auth.env,
    headers: auth.headers,
    maxTokens: 256,
    sessionId: `title_${sessionId}`,
  });
  if (response.stopReason === "error") {
    agentLog.error("title.generate.failed", {
      sessionId,
      providerId: modelConfig.provider.id,
      modelId: modelConfig.model.id,
      error: response.errorMessage || "标题生成失败",
    });
    throw new Error(response.errorMessage || "标题生成失败");
  }

  const text = response.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
  const title = normalizeGeneratedThreadTitle(text, "");
  agentLog.info("title.generate.response", {
    sessionId,
    providerId: modelConfig.provider.id,
    modelId: modelConfig.model.id,
    stopReason: response.stopReason,
    rawTitle: text,
    rawTitleLength: text.length,
    normalizedTitle: title,
  });
  return title;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function toolExecutionError(error: unknown): AgentToolExecutionError {
  return { message: formatAgentError(error) };
}

function piToolText(result: Record<string, unknown>): string {
  if (!Array.isArray(result.content)) return "";
  return result.content
    .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
    .join("\n")
    .trim();
}

function piToolOutput(toolName: string, result: unknown): unknown {
  if (!isRecord(result)) return result;
  const details = isRecord(result.details) ? result.details : {};
  if (!(PI_BUILTIN_TOOL_NAMES as readonly string[]).includes(toolName)) {
    return "details" in result ? result.details : result;
  }
  const content = piToolText(result);
  const truncation = isRecord(details.truncation) ? details.truncation : undefined;
  if (toolName === "bash") {
    return {
      ...details,
      exitCode: 0,
      stdout: content,
      stderr: "",
      truncated: !!truncation?.truncated,
    };
  }
  return {
    ...details,
    content,
    truncated: !!truncation?.truncated,
  };
}

function piToolError(result: unknown): string {
  if (isRecord(result)) {
    if (typeof result.error === "string") return result.error;
    if (Array.isArray(result.content)) {
      const text = result.content
        .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
        .join("\n")
        .trim();
      if (text) return text;
    }
  }
  return typeof result === "string" ? result : JSON.stringify(result);
}

function isRejectedApprovalOutput(output: unknown): boolean {
  return isRecord(output) && output.approvalStatus === "rejected";
}

function approvalIdForToolCall(toolCallId: string) {
  return `approval_${toolCallId}`;
}

function toolCallFromAssistantEvent(value: unknown):
  | {
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type !== "toolcall_delta" && value.type !== "toolcall_end") return undefined;
  const source = isRecord(value.toolCall)
    ? value.toolCall
    : toolCallFromPartial(value.partial, value.contentIndex);
  if (!source) return undefined;
  const toolCallId = typeof source.id === "string" ? source.id : "";
  const toolName = typeof source.name === "string" ? source.name : "";
  const args = isRecord(source.arguments) ? source.arguments : undefined;
  if (!toolCallId || !toolName || !args) return undefined;
  return { toolCallId, toolName, args };
}

function toolCallFromPartial(
  partial: unknown,
  contentIndex: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(partial) || !Array.isArray(partial.content) || typeof contentIndex !== "number") {
    return undefined;
  }
  const block = partial.content[contentIndex];
  return isRecord(block) && block.type === "toolCall" ? block : undefined;
}

function withApprovalToolResult(
  blocks: AgentReducedAssistantBlock[],
  requested: AgentApprovalRequested,
  result: { output: unknown } | { error: string },
): AgentReducedAssistantBlock[] {
  const index = blocks.findIndex(
    (block) =>
      block.kind === "approval" &&
      (block.approvalId === requested.approvalId || block.toolCallId === requested.toolCallId),
  );
  const update =
    "output" in result
      ? {
          state: "completed" as const,
          output: result.output,
          approvalState: "approved" as const,
          executionState: "completed" as const,
          displayState: "completed" as const,
          approved: true,
        }
      : {
          state: "failed" as const,
          error: result.error,
          executionError: { message: result.error },
          approvalState: "approved" as const,
          executionState: "failed" as const,
          displayState: "failed" as const,
          approved: true,
        };
  if (index < 0) {
    return [
      ...blocks,
      {
        kind: "approval",
        approvalId: requested.approvalId,
        toolCallId: requested.toolCallId,
        toolName: requested.toolName,
        title: requested.title,
        description: requested.description,
        payload: requested.payload,
        ...update,
        createdAt: requested.createdAt,
      },
    ];
  }
  return blocks.map((block, blockIndex) =>
    blockIndex === index && block.kind === "approval" ? { ...block, ...update } : block,
  );
}

export async function configurePiRuntimeAuth(
  authStorage: AuthStorage,
  modelConfig: ResolvedAiModelConfig,
): Promise<void> {
  authStorage.setRuntimeApiKey(
    modelConfig.definition.piProviderId,
    await runtimeApiKey(modelConfig),
  );
}

async function runtimeApiKey(modelConfig: ResolvedAiModelConfig): Promise<string> {
  return modelConfig.definition.authType === "codex"
    ? (await getCodexCredentials()).accessToken
    : modelConfig.provider.apiKey;
}

export class PiAgentHost {
  private readonly sessionLog: AgentSessionLog;
  private readonly activeRuns = new Map<string, ActivePiRun>();
  private readonly cancelledRunIds = new Set<string>();

  constructor(
    private readonly contentStorageRoot = getContentStorageRoot(),
    private readonly titleGenerator = generateAgentThreadTitle,
  ) {
    this.sessionLog = new AgentSessionLog(contentStorageRoot);
  }

  listThreads(): Promise<AgentSessionSummary[]> {
    return this.sessionLog.listSessions();
  }

  createThread(title?: string): AgentSessionSummary {
    return this.sessionLog.createSession(title);
  }

  async renameThread(sessionId: string, title: string): Promise<void> {
    await this.sessionLog.renameSession(sessionId, title);
  }

  async archiveThread(sessionId: string): Promise<void> {
    await this.deleteThread(sessionId);
  }

  async deleteThread(sessionId: string): Promise<void> {
    await this.sessionLog.deleteSession(sessionId);
  }

  forkThreadFromMessage(sessionId: string, messageId: string): Promise<AgentSessionSummary> {
    return this.sessionLog.forkSessionFromAssistantMessage(sessionId, messageId);
  }

  async generateThreadTitle(sessionId: string): Promise<string> {
    const events = await this.sessionLog.readEvents(sessionId);
    const state = reduceAgentSession(events);
    agentLog.info("title.persist.start", {
      sessionId,
      eventCount: events.length,
      messageCount: state.messages.length,
      userMessageCount: state.messages.filter((message) => message.role === "user").length,
      assistantMessageCount: state.messages.filter((message) => message.role === "assistant")
        .length,
    });
    const fallbackTitle = fallbackGeneratedThreadTitle(events);
    if (!fallbackTitle) {
      agentLog.warn("title.persist.noFallback", { sessionId, eventCount: events.length });
      throw new Error("没有可用于生成标题的对话内容");
    }
    const generatedTitle = normalizeGeneratedThreadTitle(
      await this.titleGenerator(events, this.contentStorageRoot),
      fallbackTitle,
    );
    const title = generatedTitle === "新对话" ? fallbackTitle : generatedTitle;
    agentLog.info("title.persist.result", {
      sessionId,
      fallbackTitle,
      generatedTitle,
      finalTitle: title,
      ignoredGenericTitle: generatedTitle === "新对话",
      usedFallback: title === fallbackTitle && generatedTitle !== fallbackTitle,
    });
    await this.renameThread(sessionId, title);
    return title;
  }

  async readSessionEvents(sessionId: string): Promise<AgentSessionEvent[]> {
    const events = await this.sessionLog.readEvents(sessionId);
    const activeRunId = reduceAgentSession(events).activeRunId;
    if (!activeRunId) return events;

    const active = this.activeRuns.get(sessionId);
    if (active?.runId === activeRunId) return this.withActiveRunSnapshot(sessionId, events, active);

    const manager = await this.sessionLog.openSession(sessionId);
    const cancelled = this.createEvent({
      type: "run.cancelled",
      sessionId,
      runId: activeRunId,
    });
    this.sessionLog.appendEvent(manager, cancelled);
    return [...events, cancelled];
  }

  private withActiveRunSnapshot(
    sessionId: string,
    events: AgentSessionEvent[],
    active: ActivePiRun,
  ): AgentSessionEvent[] {
    if (active.accumulator.isEmpty()) return events;
    return [
      ...events,
      active.accumulator.toAssistantTurn(
        this.createEvent({
          type: "assistant.turn",
          sessionId,
          runId: active.runId,
          messageId: active.assistantMessageId,
          blocks: [],
          text: "",
        }),
      ),
    ];
  }

  async sendAgentCommand(command: AgentCommand, webContents: WebContents): Promise<void> {
    if (command.type === "message.send") {
      void this.sendMessage(command, webContents).catch((error) => {
        agentLog.error("pi.run.unhandledError", {
          sessionId: command.sessionId,
          error: formatAgentError(error),
        });
      });
      return;
    }

    if (command.type === "run.cancel") {
      const active = this.activeRuns.get(command.sessionId);
      if (!active) return;
      this.cancelledRunIds.add(active.runId);
      const event = this.createEvent({
        sessionId: command.sessionId,
        runId: active.runId,
        type: "run.cancelled",
      });
      const manager = active.session.sessionManager;
      this.appendAndEmit(manager, webContents, event);
      this.rejectPendingApprovals(active, new Error("Run cancelled"));
      this.activeRuns.delete(command.sessionId);
      void active.session.abort().catch((error) => {
        agentLog.error("pi.run.cancelFailed", {
          sessionId: command.sessionId,
          runId: active.runId,
          error: formatAgentError(error),
        });
      });
    }

    if (command.type === "tool.approve" || command.type === "tool.reject") {
      await this.resolveToolApproval(command, webContents);
    }
  }

  private async createSession(
    command: Extract<AgentCommand, { type: "message.send" }>,
    sessionManager: SessionManager,
    collectToolOutput: (
      toolName: string,
      toolCallId: string,
      output: unknown,
    ) => string | undefined,
    onDangerousBashApproval: DangerousBashApprovalHandler,
  ) {
    const modelConfig = getAiModelConfig(command.modelSelection as AiModelSelection | undefined);
    const agentDir = path.join(this.contentStorageRoot, ".pi-agent");
    fs.mkdirSync(agentDir, { recursive: true });
    const authStorage = AuthStorage.create(path.join(agentDir, "auth.json"));
    await configurePiRuntimeAuth(authStorage, modelConfig);
    const modelRegistry = ModelRegistry.inMemory(authStorage);
    const model = resolvePiModel(modelConfig.definition.piProviderId, modelConfig.model.id);
    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: false },
    });
    const resourceLoader = await createPiResourceLoader({
      cwd: this.contentStorageRoot,
      agentDir,
      settingsManager,
      onDangerousBashApproval,
    });

    const created = await createAgentSession({
      agentDir,
      authStorage,
      customTools: [
        ...createPiReadOnlyTools(command.files, {
          collectToolOutput,
        }),
        ...createPiWriteTools({
          onApproval: ({ toolCallId }) => this.waitForToolApproval(command.sessionId, toolCallId),
        }),
      ],
      cwd: this.contentStorageRoot,
      model,
      modelRegistry,
      resourceLoader,
      sessionManager,
      settingsManager,
      thinkingLevel: thinkingLevelFor(command.reasoningLevel ?? getActiveAgentReasoningLevel()),
      tools: [...PI_BUILTIN_TOOL_NAMES, ...PI_READ_ONLY_TOOL_NAMES, ...PI_APPROVAL_TOOL_NAMES],
    });
    return { ...created, modelConfig };
  }

  private createEvent<T extends AgentEvent["type"]>(
    input: Omit<Extract<AgentEvent, { type: T }>, "createdAt" | "id"> & { type: T },
  ): Extract<AgentEvent, { type: T }> {
    return {
      ...input,
      id: `evt_${nanoid()}`,
      createdAt: new Date().toISOString(),
    } as Extract<AgentEvent, { type: T }>;
  }

  private appendAndEmit(
    manager: SessionManager,
    webContents: WebContents,
    event: AgentSessionEvent,
  ): void {
    this.sessionLog.appendEvent(manager, event);
    if (!webContents.isDestroyed()) webContents.send(AGENT_EVENT_CHANNEL, event);
  }

  private appendEntityCatalogUpdates(
    manager: SessionManager,
    webContents: WebContents,
    sessionId: string,
    runId: string,
    registry: AgentEntityCatalog,
  ): void {
    const catalogUpdates = registry.drainUpdates();
    if (catalogUpdates.length === 0) return;
    this.appendAndEmit(
      manager,
      webContents,
      this.createEvent({
        type: "entity.catalog.updated",
        sessionId,
        runId,
        entries: catalogUpdates,
      }),
    );
  }

  private emitLive(webContents: WebContents, event: AgentLiveEvent): void {
    if (!webContents.isDestroyed()) webContents.send(AGENT_EVENT_CHANNEL, event);
  }

  private appendToolExecutionStarted(
    manager: SessionManager,
    webContents: WebContents,
    requested: AgentApprovalRequested,
  ): void {
    this.appendAndEmit(
      manager,
      webContents,
      this.createEvent({
        type: "tool.execution.started",
        sessionId: requested.sessionId,
        runId: requested.runId,
        messageId: requested.messageId,
        toolCallId: requested.toolCallId,
        toolName: requested.toolName,
        input: requested.payload,
      }),
    );
  }

  private appendToolExecutionCompleted(
    manager: SessionManager,
    webContents: WebContents,
    requested: AgentApprovalRequested,
    output: unknown,
  ): void {
    this.appendAndEmit(
      manager,
      webContents,
      this.createEvent({
        type: "tool.execution.completed",
        sessionId: requested.sessionId,
        runId: requested.runId,
        messageId: requested.messageId,
        toolCallId: requested.toolCallId,
        toolName: requested.toolName,
        output,
      }),
    );
  }

  private appendToolExecutionFailed(
    manager: SessionManager,
    webContents: WebContents,
    requested: AgentApprovalRequested,
    error: unknown,
  ): void {
    this.appendAndEmit(
      manager,
      webContents,
      this.createEvent({
        type: "tool.execution.failed",
        sessionId: requested.sessionId,
        runId: requested.runId,
        messageId: requested.messageId,
        toolCallId: requested.toolCallId,
        toolName: requested.toolName,
        error: toolExecutionError(error),
      }),
    );
  }

  private async sendMessage(
    command: Extract<AgentCommand, { type: "message.send" }>,
    webContents: WebContents,
  ) {
    const runId = `run_${nanoid()}`;
    const userMessageId = command.messageId ?? `msg_${nanoid()}`;
    const assistantMessageId = `msg_${nanoid()}`;
    const manager = command.messageId
      ? await this.sessionLog.openSessionForEditedMessage(command.sessionId, command.messageId)
      : await this.sessionLog.openSession(command.sessionId);
    const entityCatalog = new AgentEntityCatalog(
      reduceAgentSession(this.sessionLog.eventsFromManager(manager)).entityCatalog,
    );
    const contextCatalog = entityCatalog.addUserContextRefs(userMessageId, command.contextRefs);
    let session: AgentSession | undefined;
    let unsubscribe: (() => void) | undefined;
    let piDraftText = "";
    let assistantError = "";
    let assistantMetadata: AssistantTurnMetadata | undefined;
    let assistantActivity = false;
    let runStarted = false;
    const accumulator = new AgentRunAccumulator();
    const requestedApprovalIds = new Set<string>();
    const approvalRequestTasks: Promise<void>[] = [];
    const emit = (event: AgentSessionEvent) => this.appendAndEmit(manager, webContents, event);
    const emitAccumulated = (event: AgentLiveEvent) => {
      accumulator.append(event);
      this.emitLive(webContents, event);
    };
    const createApprovalRequested = (
      toolCallId: string,
      toolName: PiApprovalToolName,
      payload: Record<string, unknown>,
      preview = false,
    ) =>
      this.createEvent({
        type: "approval.requested",
        sessionId: command.sessionId,
        runId,
        messageId: assistantMessageId,
        approvalId: approvalIdForToolCall(toolCallId),
        toolCallId,
        toolName,
        title: approvalTitleForTool(toolName),
        payload,
        ...(preview ? { preview: true } : {}),
      });
    const emitApprovalPreview = (
      toolCallId: string,
      toolName: PiApprovalToolName,
      payload: Record<string, unknown>,
    ) => {
      if (requestedApprovalIds.has(approvalIdForToolCall(toolCallId))) return;
      const requested = createApprovalRequested(toolCallId, toolName, payload, true);
      if (!webContents.isDestroyed()) webContents.send(AGENT_EVENT_CHANNEL, requested);
    };
    const emitApprovalRequest = (
      toolCallId: string,
      toolName: PiApprovalToolName,
      payload: Record<string, unknown>,
    ) => {
      const approvalId = approvalIdForToolCall(toolCallId);
      if (requestedApprovalIds.has(approvalId)) return;
      requestedApprovalIds.add(approvalId);
      const task = hydratePiApprovalPayload(toolName, payload)
        .catch((error) => {
          agentLog.warn("pi.approval.hydrateFailed", {
            sessionId: command.sessionId,
            runId,
            toolName,
            toolCallId,
            error: formatAgentError(error),
          });
          return payload;
        })
        .then((hydratedPayload) => {
          const requested = createApprovalRequested(toolCallId, toolName, hydratedPayload);
          accumulator.append(requested);
          emit(requested);
        });
      approvalRequestTasks.push(task);
    };
    const requestDangerousBashApproval: DangerousBashApprovalHandler = async ({
      toolCallId,
      command: bashCommand,
      matchedRules,
    }) => {
      const approvalId = approvalIdForToolCall(toolCallId);
      if (requestedApprovalIds.has(approvalId)) {
        throw new Error(`Duplicate approval request: ${approvalId}`);
      }
      requestedApprovalIds.add(approvalId);
      const requested = this.createEvent({
        type: "approval.requested",
        sessionId: command.sessionId,
        runId,
        messageId: assistantMessageId,
        approvalId,
        toolCallId,
        toolName: "bash",
        title: "确认危险 Bash",
        description: `命中危险规则：${matchedRules.join("、")}`,
        payload: { command: bashCommand, matchedRules },
      });
      accumulator.append(requested);
      emit(requested);
      return this.waitForBashGateApproval(command.sessionId, toolCallId);
    };
    const emitEntityCatalogUpdates = () => {
      this.appendEntityCatalogUpdates(
        manager,
        webContents,
        command.sessionId,
        runId,
        entityCatalog,
      );
    };
    const collectToolOutputEntities = (toolName: string, toolCallId: string, output: unknown) => {
      const before = new Map(
        entityCatalog.snapshot().map((entry) => [entry.key, JSON.stringify(entry.entity)]),
      );
      entityCatalog.collectToolOutput(toolName, toolCallId, output);
      const changed = entityCatalog
        .snapshot()
        .filter((entry) => before.get(entry.key) !== JSON.stringify(entry.entity));
      return formatEntityRecordsForPrompt(changed);
    };
    const emitRunStarted = () => {
      if (runStarted) return;
      runStarted = true;
      emit(this.createEvent({ type: "run.started", sessionId: command.sessionId, runId }));
      emitEntityCatalogUpdates();
      emit(
        this.createEvent({
          type: "user.message",
          sessionId: command.sessionId,
          runId,
          messageId: userMessageId,
          text: command.text,
          contextRefs: command.contextRefs,
          files: command.files,
          composerContent: command.composerContent,
        }),
      );
    };

    try {
      const created = await this.createSession(
        command,
        manager,
        collectToolOutputEntities,
        requestDangerousBashApproval,
      );
      session = created.session;
      this.activeRuns.set(command.sessionId, {
        runId,
        assistantMessageId,
        session,
        accumulator,
        pendingApprovals: new Map(),
        entityCatalog,
      });
      unsubscribe = session.subscribe((event) => {
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          piDraftText += event.assistantMessageEvent.delta;
          assistantActivity = true;
          emitAccumulated(
            this.createEvent({
              type: "assistant.text.delta",
              sessionId: command.sessionId,
              runId,
              messageId: assistantMessageId,
              delta: event.assistantMessageEvent.delta,
            }),
          );
          return;
        }

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "thinking_delta"
        ) {
          assistantActivity = true;
          emitAccumulated(
            this.createEvent({
              type: "assistant.reasoning.delta",
              sessionId: command.sessionId,
              runId,
              messageId: assistantMessageId,
              delta: event.assistantMessageEvent.delta,
            }),
          );
          return;
        }

        if (event.type === "message_update") {
          const toolCall = toolCallFromAssistantEvent(event.assistantMessageEvent);
          if (toolCall && isPiApprovalToolName(toolCall.toolName)) {
            assistantActivity = true;
            emitApprovalPreview(toolCall.toolCallId, toolCall.toolName, toolCall.args);
            return;
          }
        }

        if (event.type === "tool_execution_start") {
          assistantActivity = true;
          if (isPiApprovalToolName(event.toolName)) {
            emitApprovalRequest(
              event.toolCallId,
              event.toolName,
              isRecord(event.args) ? event.args : {},
            );
            return;
          }
          if (
            event.toolName === "bash" &&
            isRecord(event.args) &&
            typeof event.args.command === "string" &&
            dangerousBashRuleLabels(event.args.command).length > 0
          ) {
            return;
          }
          emitAccumulated(
            this.createEvent({
              type: "tool.started",
              sessionId: command.sessionId,
              runId,
              messageId: assistantMessageId,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              input: event.args,
            }),
          );
          return;
        }

        if (event.type === "tool_execution_end") {
          if (isPiApprovalToolName(event.toolName)) {
            const output = piToolOutput(event.toolName, event.result);
            if (isRejectedApprovalOutput(output)) return;
            if (event.isError) {
              emitAccumulated(
                this.createEvent({
                  type: "tool.failed",
                  sessionId: command.sessionId,
                  runId,
                  messageId: assistantMessageId,
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  error: piToolError(event.result),
                }),
              );
              return;
            }
            emitEntityCatalogUpdates();
            emitAccumulated(
              this.createEvent({
                type: "tool.completed",
                sessionId: command.sessionId,
                runId,
                messageId: assistantMessageId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                output,
              }),
            );
            return;
          }
          if (event.isError) {
            emitAccumulated(
              this.createEvent({
                type: "tool.failed",
                sessionId: command.sessionId,
                runId,
                messageId: assistantMessageId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                error: piToolError(event.result),
              }),
            );
            return;
          }
          emitEntityCatalogUpdates();
          emitAccumulated(
            this.createEvent({
              type: "tool.completed",
              sessionId: command.sessionId,
              runId,
              messageId: assistantMessageId,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              output: piToolOutput(event.toolName, event.result),
            }),
          );
          return;
        }

        if (event.type === "message_end") {
          const metadata = extractAssistantTurnMetadata(event.message);
          if (metadata) assistantMetadata = metadata;
          const error = extractAssistantError(event.message);
          if (error) {
            assistantError = error;
            return;
          }
        }

        if (event.type === "message_end" && !piDraftText) {
          const finalText = extractAssistantText(event.message);
          if (!finalText) return;
          piDraftText = finalText;
          assistantActivity = true;
        }
      });
      emitRunStarted();
      await session.prompt(
        buildPiPromptText({
          text: command.text,
          contextRefs: command.contextRefs,
          contextCatalog,
          entityCatalog: entityCatalog.snapshot(),
          files: command.files,
        }),
      );
      await Promise.all(approvalRequestTasks);
      if (this.cancelledRunIds.has(runId)) return;
      if (assistantError) {
        throw new Error(assistantError);
      }
      if (!piDraftText.trim() && !assistantActivity) {
        throw new Error("Agent response was empty");
      }
      accumulator.appendFinalAnswer({
        id: `evt_${nanoid()}`,
        sessionId: command.sessionId,
        runId,
        messageId: assistantMessageId,
        createdAt: new Date().toISOString(),
        text: piDraftText,
      });
      const contextUsage = session.getContextUsage?.();
      emit(
        accumulator.toAssistantTurn(
          this.createEvent({
            type: "assistant.turn",
            sessionId: command.sessionId,
            runId,
            messageId: assistantMessageId,
            blocks: [],
            text: "",
            ...assistantMetadata,
            contextUsage,
          }),
        ),
      );
      emit(this.createEvent({ type: "run.completed", sessionId: command.sessionId, runId }));
    } catch (error) {
      emitRunStarted();
      if (this.cancelledRunIds.has(runId)) return;
      const errorText = formatAgentError(error);
      agentLog.error("pi.run.failed", {
        sessionId: command.sessionId,
        runId,
        error: errorText,
        stack: errorStack(error),
      });
      emit(
        accumulator.toAssistantTurn(
          this.createEvent({
            type: "assistant.turn",
            sessionId: command.sessionId,
            runId,
            messageId: assistantMessageId,
            blocks: [],
            text: "",
            ...assistantMetadata,
          }),
        ),
      );
      emit(
        this.createEvent({
          type: "run.failed",
          sessionId: command.sessionId,
          runId,
          error: errorText,
        }),
      );
    } finally {
      const active = this.activeRuns.get(command.sessionId);
      if (active?.runId === runId) {
        this.rejectPendingApprovals(active, new Error("Run ended before approval resolved"));
      }
      unsubscribe?.();
      session?.dispose();
      this.cancelledRunIds.delete(runId);
      this.activeRuns.delete(command.sessionId);
    }
  }

  private waitForToolApproval(
    sessionId: string,
    toolCallId: string,
  ): Promise<PiApprovedToolOutput | ReturnType<typeof rejectedToolResult>> {
    const active = this.activeRuns.get(sessionId);
    if (!active) throw new Error("Approval requested without an active run");
    const approvalId = approvalIdForToolCall(toolCallId);
    if (active.pendingApprovals.has(approvalId)) {
      throw new Error(`Duplicate approval request: ${approvalId}`);
    }

    return new Promise<PiApprovedToolOutput | ReturnType<typeof rejectedToolResult>>(
      (resolve, reject) => {
        active.pendingApprovals.set(approvalId, {
          kind: "mutation",
          resolve,
          reject,
        });
      },
    ).finally(() => {
      this.activeRuns.get(sessionId)?.pendingApprovals.delete(approvalId);
    });
  }

  private waitForBashGateApproval(sessionId: string, toolCallId: string): Promise<boolean> {
    const active = this.activeRuns.get(sessionId);
    if (!active) throw new Error("Approval requested without an active run");
    const approvalId = approvalIdForToolCall(toolCallId);
    if (active.pendingApprovals.has(approvalId)) {
      throw new Error(`Duplicate approval request: ${approvalId}`);
    }

    return new Promise<boolean>((resolve, reject) => {
      active.pendingApprovals.set(approvalId, {
        kind: "bash_gate",
        resolve,
        reject,
      });
    }).finally(() => {
      this.activeRuns.get(sessionId)?.pendingApprovals.delete(approvalId);
    });
  }

  private rejectPendingApprovals(active: ActivePiRun, error: Error): void {
    for (const pending of active.pendingApprovals.values()) pending.reject(error);
    active.pendingApprovals.clear();
  }

  private async resolveToolApproval(
    command: Extract<AgentCommand, { type: "tool.approve" | "tool.reject" }>,
    webContents: WebContents,
  ) {
    const manager = await this.sessionLog.openSession(command.sessionId);
    const events = await this.sessionLog.readEvents(command.sessionId);
    const requested = events.findLast(
      (event): event is AgentApprovalRequested =>
        event.type === "approval.requested" && event.approvalId === command.approvalId,
    );
    if (!requested) throw new Error("Approval request not found");
    const alreadyResolved = events.some(
      (event) => event.type === "approval.resolved" && event.approvalId === command.approvalId,
    );
    if (alreadyResolved) return;

    const approved = command.type === "tool.approve";
    const resolved = this.createEvent({
      type: "approval.resolved",
      sessionId: command.sessionId,
      runId: requested.runId,
      messageId: requested.messageId,
      approvalId: requested.approvalId,
      toolCallId: requested.toolCallId,
      toolName: requested.toolName,
      approved,
    });
    this.appendAndEmit(manager, webContents, resolved);
    const active = this.activeRuns.get(command.sessionId);
    if (active?.runId === requested.runId) active.accumulator.append(resolved);
    const pending =
      active?.runId === requested.runId
        ? active.pendingApprovals.get(requested.approvalId)
        : undefined;

    if (pending?.kind === "bash_gate") {
      pending.resolve(approved);
      return;
    }

    if (pending && active) {
      if (!isPiApprovalToolName(requested.toolName)) {
        const error = new Error(`Unsupported approval tool: ${requested.toolName}`);
        pending.reject(error);
        return;
      }
      if (!approved) {
        pending.resolve(rejectedToolResult(requested.toolName));
        return;
      }
      this.appendToolExecutionStarted(manager, webContents, requested);
      void this.executeApprovedTool(requested, active.entityCatalog).then(
        (output) => {
          this.appendEntityCatalogUpdates(
            manager,
            webContents,
            requested.sessionId,
            requested.runId,
            active.entityCatalog,
          );
          this.appendToolExecutionCompleted(manager, webContents, requested, output);
          pending.resolve(output);
        },
        (error) => {
          this.appendToolExecutionFailed(manager, webContents, requested, error);
          pending.reject(error);
        },
      );
      return;
    }

    if (!approved) return;

    if (requested.toolName === "bash") {
      const error = new Error("危险 Bash 确认已过期，请让 Agent 重新发起命令。");
      this.appendToolExecutionFailed(manager, webContents, requested, error);
      return;
    }

    const existingTurn = events.findLast(
      (event): event is Extract<AgentSessionEvent, { type: "assistant.turn" }> =>
        event.type === "assistant.turn" && event.messageId === requested.messageId,
    );
    try {
      this.appendToolExecutionStarted(manager, webContents, requested);
      const registry = new AgentEntityCatalog(reduceAgentSession(events).entityCatalog);
      const output = await this.executeApprovedTool(requested, registry);
      this.appendEntityCatalogUpdates(
        manager,
        webContents,
        requested.sessionId,
        requested.runId,
        registry,
      );
      this.appendToolExecutionCompleted(manager, webContents, requested, output);
      this.appendAndEmit(
        manager,
        webContents,
        this.createEvent({
          type: "assistant.turn",
          sessionId: command.sessionId,
          runId: requested.runId,
          messageId: requested.messageId,
          text: existingTurn?.text ?? "",
          blocks: withApprovalToolResult(existingTurn?.blocks ?? [], requested, { output }),
        }),
      );
    } catch (error) {
      this.appendToolExecutionFailed(manager, webContents, requested, error);
      this.appendAndEmit(
        manager,
        webContents,
        this.createEvent({
          type: "assistant.turn",
          sessionId: command.sessionId,
          runId: requested.runId,
          messageId: requested.messageId,
          text: existingTurn?.text ?? "",
          blocks: withApprovalToolResult(existingTurn?.blocks ?? [], requested, {
            error: formatAgentError(error),
          }),
        }),
      );
    }
  }

  private async executeApprovedTool(
    requested: AgentApprovalRequested,
    registry?: AgentEntityCatalog,
  ): Promise<PiApprovedToolOutput> {
    if (!isPiApprovalToolName(requested.toolName)) {
      throw new Error(`Unsupported approval tool: ${requested.toolName}`);
    }
    return this.decorateApprovedToolOutput(
      requested,
      await executePiApprovedTool(requested.toolName, requested.payload),
      registry,
    );
  }

  private decorateApprovedToolOutput(
    requested: AgentApprovalRequested,
    output: PiApprovedToolOutput,
    registry?: AgentEntityCatalog,
  ): PiApprovedToolOutput {
    if (!registry || !isMutationOutput(output)) return output;
    registry.addEntity(
      {
        type: output.resultRefType,
        id: output.resultRefId,
        ...(output.resultRefTitle ? { title: output.resultRefTitle } : {}),
      },
      { kind: "tool_result", toolCallId: requested.toolCallId, toolName: requested.toolName },
    );
    return output;
  }
}

function isMutationOutput(output: PiApprovedToolOutput): output is PiApprovedToolOutput & {
  resultRefType: AgentContextRef["type"];
  resultRefId: string;
  resultRefTitle?: string;
} {
  return (
    "resultRefType" in output &&
    (output.resultRefType === "understanding" ||
      output.resultRefType === "context" ||
      output.resultRefType === "domain") &&
    typeof output.resultRefId === "string"
  );
}
