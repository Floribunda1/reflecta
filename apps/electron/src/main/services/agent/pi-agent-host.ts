import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getModel, type Api, type Context, type Model } from "@earendil-works/pi-ai/compat";
import {
  createAgentSession,
  createBashToolDefinition,
  DefaultResourceLoader,
  defineTool,
  loadSkillsFromDir,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent as PiAgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import { nanoid } from "nanoid";
import { reduceAgentSession } from "@shared/agent";
import type {
  AgentCommand,
  AgentContextUsage,
  AgentContextRef,
  AgentEntityCatalogEntry,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentApprovalRequested,
  AgentAssistantTurn,
  AgentReducedAssistantBlock,
  AgentEvent,
  AgentLiveEvent,
  AgentSessionEvent,
  AgentSessionFeedFrame,
  AgentSessionProjection,
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
} from "../../config";
import { agentLog } from "../../logger";
import { AgentSessionRuntime } from "./agent-session-runtime";
import { AgentEntityCatalog } from "./agent-entity-catalog";
import { AgentSessionLog } from "./pi-session-log";
import { formatAgentError } from "./error";
import { buildPiPromptText } from "./pi-prompt";
import { getSharedModelRuntime } from "./pi-model-runtime";
import agentSystemPrompt from "./agent-system-prompt.md?raw";
import contextSkill from "./builtin-skills/reflecta-context/SKILL.md?raw";
import understandingSkill from "./builtin-skills/reflecta-understanding/SKILL.md?raw";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";
import { createPiEntityCatalogContext } from "./pi-entity-catalog-context";
import { contextCompactionSettings, createPiContextCompaction } from "./pi-context-compaction";
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
import { createPiWebAccessResources, PI_WEB_ACCESS_TOOL_NAMES } from "./pi-web-access";
import { extractPiAssistantError, extractPiAssistantText } from "./pi-message";
import { createPiImageTools, PI_IMAGE_TOOL_NAMES } from "./codex-image-generation";

type ActivePiRun = {
  runId: string;
  assistantMessageId: string;
  session: AgentSession;
  pendingApprovals: Map<string, PendingApproval>;
  entityCatalog: AgentEntityCatalog;
};

type PiSessionCommand = Extract<AgentCommand, { type: "message.send" | "context.compact" }>;
type PiMessageCommand = Extract<AgentCommand, { type: "message.send" }> & {
  visibleUserMessage?: boolean;
};

function contextCompactionErrorMessage(error: string): string {
  const message = error.replace(/^Compaction failed:\s*/i, "");
  if (message.includes("Nothing to compact")) return "当前对话还不需要压缩";
  if (message.includes("Already compacted")) return "当前上下文已经是压缩后的状态";
  return message;
}

type MutationPendingApproval = {
  kind: "mutation";
  resolve: (output: PiApprovedToolOutput | ReturnType<typeof rejectedToolResult>) => void;
  reject: (error: Error) => void;
};

type BashGatePendingApproval = {
  kind: "bash_gate";
  resolve: (decision: { approved: true } | { approved: false; reason?: string }) => void;
  reject: (error: Error) => void;
};

type PendingApproval = MutationPendingApproval | BashGatePendingApproval;

export const PI_BUILTIN_TOOL_NAMES = ["read", "bash", "edit", "write"] as const;
export const PI_BUILTIN_SKILL_NAMES = ["reflecta-understanding", "reflecta-context"] as const;

export type AgentSkillSummary = { name: string; description: string };

export function getGlobalAgentSkillsDir(homeDirectory = os.homedir()): string {
  return path.join(homeDirectory, ".agents", "skills");
}

export function listGlobalAgentSkills(skillsDir = getGlobalAgentSkillsDir()): AgentSkillSummary[] {
  const hiddenNames = new Set<string>(PI_BUILTIN_SKILL_NAMES);
  const summaries: AgentSkillSummary[] = [];
  for (const skill of loadSkillsFromDir({ dir: skillsDir, source: "user" }).skills) {
    if (hiddenNames.has(skill.name)) continue;
    hiddenNames.add(skill.name);
    summaries.push({ name: skill.name, description: skill.description });
  }
  return summaries.sort((left, right) => left.name.localeCompare(right.name));
}

export function expandDollarSkillInvocation(text: string, skillNames: readonly string[]): string {
  const match = /^\s*\$([^\s$]+)(?=\s|$)/.exec(text);
  if (!match || !skillNames.includes(match[1])) return text;
  return `/skill:${match[1]}${text.slice(match[0].length)}`;
}

const PI_BASH_UTF8_LOCALE = process.platform === "darwin" ? "en_US.UTF-8" : "C.UTF-8";
const PI_BUILTIN_SKILLS = [
  { name: PI_BUILTIN_SKILL_NAMES[0], content: `${understandingSkill.trim()}\n` },
  { name: PI_BUILTIN_SKILL_NAMES[1], content: `${contextSkill.trim()}\n` },
] as const;

function installPiBuiltinSkills(agentDir: string): string[] {
  return PI_BUILTIN_SKILLS.map((skill) => {
    const skillDir = path.join(agentDir, "builtin-skills", skill.name);
    const skillPath = path.join(skillDir, "SKILL.md");
    fs.mkdirSync(skillDir, { recursive: true });
    if (!fs.existsSync(skillPath) || fs.readFileSync(skillPath, "utf8") !== skill.content) {
      fs.writeFileSync(skillPath, skill.content, "utf8");
    }
    return skillPath;
  });
}

export function createPiBashTool(cwd: string) {
  return defineTool(
    createBashToolDefinition(cwd, {
      spawnHook: (context) => {
        const effectiveLocale = context.env.LC_ALL ?? context.env.LC_CTYPE ?? context.env.LANG;
        if (effectiveLocale && /utf-?8/i.test(effectiveLocale)) return context;
        return {
          ...context,
          env: {
            ...context.env,
            LANG: PI_BASH_UTF8_LOCALE,
            LC_ALL: PI_BASH_UTF8_LOCALE,
          },
        };
      },
    }),
  );
}

function loadAgentSystemPrompt(): string {
  return agentSystemPrompt.trim();
}

export async function createPiResourceLoader(input: {
  cwd: string;
  agentDir: string;
  globalSkillsDir?: string;
  settingsManager: SettingsManager;
  onDangerousBashApproval: DangerousBashApprovalHandler;
  getEntityCatalog: () => AgentEntityCatalogEntry[];
}): Promise<DefaultResourceLoader> {
  const webAccess = createPiWebAccessResources(input.agentDir);
  const globalSkillsDir = input.globalSkillsDir ?? getGlobalAgentSkillsDir();
  const loader = new DefaultResourceLoader({
    cwd: input.cwd,
    agentDir: input.agentDir,
    settingsManager: input.settingsManager,
    systemPrompt: loadAgentSystemPrompt(),
    noExtensions: true,
    noSkills: true,
    additionalSkillPaths: [
      ...installPiBuiltinSkills(input.agentDir),
      ...(fs.existsSync(globalSkillsDir) ? [globalSkillsDir] : []),
    ],
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    additionalExtensionPaths: webAccess.additionalExtensionPaths,
    extensionFactories: [
      ...webAccess.extensionFactories,
      createPiBashPermissionGate(input.onDangerousBashApproval),
      createPiEntityCatalogContext(input.getEntityCatalog),
      createPiContextCompaction(),
    ],
  });
  await loader.reload();
  return loader;
}

function resolvePiModel(
  providerId: string,
  modelId: string,
  modelRuntime?: ModelRuntime,
): Model<Api> {
  const model = modelRuntime
    ? modelRuntime.getModel(providerId, modelId)
    : (getModel as (provider: string, modelId: string) => Model<Api> | undefined)(
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

async function generateAgentThreadTitle(
  events: AgentSessionEvent[],
  contentStorageRoot = getContentStorageRoot(),
): Promise<string> {
  const sessionId = events[0]?.sessionId ?? "session";
  const context = buildThreadTitleContext(events);
  if (!context) {
    agentLog.warn("title.generate.noContext", {
      sessionId,
      eventCount: events.length,
    });
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
  const modelRuntime = await getSharedModelRuntime();
  const model = resolvePiModel(modelConfig.provider.id, modelConfig.model.id, modelRuntime);

  const response = await modelRuntime.completeSimple(model, context, {
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

function piWebAccessResultError(toolName: string, result: unknown): string | undefined {
  if (!(PI_WEB_ACCESS_TOOL_NAMES as readonly string[]).includes(toolName) || !isRecord(result)) {
    return undefined;
  }
  const details = isRecord(result.details) ? result.details : {};
  return typeof details.error === "string" && details.error.trim() ? details.error : undefined;
}

function isRejectedApprovalOutput(output: unknown): boolean {
  return isRecord(output) && output.approvalStatus === "rejected";
}

function approvalIdForToolCall(toolCallId: string) {
  return `approval_${toolCallId}`;
}

function approvalContinuationPrompt(input: {
  requested: AgentApprovalRequested;
  approved: boolean;
  rejectionReason?: string;
  outcome?: unknown;
  error?: string;
}): string {
  const decision = input.approved
    ? "The user approved the requested action."
    : input.rejectionReason
      ? `The user rejected the requested action. Reason: ${input.rejectionReason}`
      : "The user rejected the requested action.";
  const outcome = input.error
    ? `The action failed: ${input.error}`
    : input.approved
      ? `The action result is: ${JSON.stringify(input.outcome ?? null)}`
      : "The action was not executed.";
  return [
    "Continue the existing user task after the saved decision below.",
    `Requested action: ${input.requested.toolName}`,
    decision,
    outcome,
    "Respond directly to the user. Do not ask them to repeat the decision.",
  ].join("\n");
}

function approvalEntityId(
  toolName: PiApprovalToolName,
  payload: Record<string, unknown>,
): { key: string; value: string } | undefined {
  const key =
    toolName === "understanding_update"
      ? "understandingId"
      : toolName === "domain_update"
        ? "domainId"
        : toolName === "context_update"
          ? "contextId"
          : undefined;
  const value = key ? payload[key] : undefined;
  return key && typeof value === "string" && value.trim() ? { key, value } : undefined;
}

function previewEntityId(
  toolName: PiApprovalToolName,
  payload: Record<string, unknown>,
  complete = false,
): string | undefined {
  const entity = approvalEntityId(toolName, payload);
  if (!entity) return undefined;
  const keys = Object.keys(payload);
  return complete || keys.indexOf(entity.key) < keys.length - 1 ? entity.value : undefined;
}

function hasHydratedBefore(payload: Record<string, unknown>): boolean {
  return isRecord(payload.before);
}

function mergeHydratedApprovalPayload(
  hydrated: Record<string, unknown>,
  latest: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...hydrated, ...latest };
  return hasHydratedBefore(hydrated) ? { ...merged, before: hydrated.before } : merged;
}

function toolCallFromAssistantEvent(value: unknown):
  | {
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      complete: boolean;
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
  return { toolCallId, toolName, args, complete: value.type === "toolcall_end" };
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

export class PiAgentHost {
  private readonly sessionLog: AgentSessionLog;
  private readonly sessionRuntime: AgentSessionRuntime;
  private readonly activeRuns = new Map<string, ActivePiRun>();
  private readonly activeCompactions = new Map<string, AgentSession>();
  private readonly cancelledRunIds = new Set<string>();

  constructor(
    private readonly contentStorageRoot = getContentStorageRoot(),
    private readonly titleGenerator = generateAgentThreadTitle,
    private readonly globalSkillsDir = getGlobalAgentSkillsDir(),
  ) {
    this.sessionLog = new AgentSessionLog(contentStorageRoot);
    this.sessionRuntime = new AgentSessionRuntime((sessionId) =>
      this.sessionLog.readEvents(sessionId),
    );
  }

  listThreads(): Promise<AgentSessionSummary[]> {
    return this.sessionLog.listSessions();
  }

  listSkills(): AgentSkillSummary[] {
    return listGlobalAgentSkills(this.globalSkillsDir);
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
    await this.sessionRuntime.projection(sessionId);
    await this.sessionLog.deleteSession(sessionId);
    this.sessionRuntime.forget(sessionId);
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
      agentLog.warn("title.persist.noFallback", {
        sessionId,
        eventCount: events.length,
      });
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

  async readSessionProjection(sessionId: string): Promise<AgentSessionProjection> {
    await this.reconcileInterruptedRun(sessionId);
    return this.sessionRuntime.projection(sessionId);
  }

  async watchSession(
    sessionId: string,
    receive: (frame: AgentSessionFeedFrame) => void,
  ): Promise<() => void> {
    await this.reconcileInterruptedRun(sessionId);
    return this.sessionRuntime.watch(sessionId, receive);
  }

  private async reconcileInterruptedRun(sessionId: string): Promise<void> {
    const projection = await this.sessionRuntime.projection(sessionId);
    const activeRunId = projection.activeRunId;
    if (!activeRunId || this.activeRuns.get(sessionId)?.runId === activeRunId) return;

    const manager = await this.sessionLog.openSession(sessionId);
    const cancelled = this.createEvent({
      type: "run.cancelled",
      sessionId,
      runId: activeRunId,
    });
    this.sessionLog.appendEvent(manager, cancelled);
    this.sessionRuntime.apply(cancelled);
  }

  async sendAgentCommand(command: AgentCommand): Promise<void> {
    if (command.type === "message.send") {
      void this.sendMessage(command).catch((error) => {
        agentLog.error("pi.run.unhandledError", {
          sessionId: command.sessionId,
          error: formatAgentError(error),
        });
      });
      return;
    }

    if (command.type === "context.compact") {
      await this.compactContext(command);
      return;
    }

    if (command.type === "run.cancel") {
      const active = this.activeRuns.get(command.sessionId);
      if (!active) return;
      this.cancelledRunIds.add(active.runId);
      const manager = active.session.sessionManager;
      if (this.sessionRuntime.hasAssistantContent(command.sessionId, active.assistantMessageId)) {
        this.appendAndPublish(
          manager,
          this.sessionRuntime.assistantTurn(
            this.createEvent({
              type: "assistant.turn",
              sessionId: command.sessionId,
              runId: active.runId,
              messageId: active.assistantMessageId,
              blocks: [],
              text: "",
            }),
          ),
        );
      }
      const event = this.createEvent({
        sessionId: command.sessionId,
        runId: active.runId,
        type: "run.cancelled",
      });
      this.appendAndPublish(manager, event);
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
      await this.resolveToolApproval(command);
    }
  }

  private async createSession(
    command: PiSessionCommand,
    sessionManager: SessionManager,
    entityCatalog: AgentEntityCatalog,
    onDangerousBashApproval: DangerousBashApprovalHandler,
  ) {
    const modelConfig = getAiModelConfig(command.modelSelection as AiModelSelection | undefined);
    const agentDir = path.join(this.contentStorageRoot, ".pi-agent");
    fs.mkdirSync(agentDir, { recursive: true });
    const modelRuntime = await getSharedModelRuntime();
    const model = resolvePiModel(
      modelConfig.definition.piProviderId,
      modelConfig.model.id,
      modelRuntime,
    );
    const settingsManager = SettingsManager.inMemory({
      compaction: contextCompactionSettings,
      retry: { enabled: false },
    });
    const resourceLoader = await createPiResourceLoader({
      cwd: this.contentStorageRoot,
      agentDir,
      globalSkillsDir: this.globalSkillsDir,
      settingsManager,
      onDangerousBashApproval,
      getEntityCatalog: () => entityCatalog.snapshot(),
    });

    const created = await createAgentSession({
      agentDir,
      customTools: [
        createPiBashTool(this.contentStorageRoot),
        ...createPiReadOnlyTools(command.type === "message.send" ? command.files : undefined, {
          collectToolOutput: (toolName, toolCallId, output) =>
            entityCatalog.collectToolOutput(toolName, toolCallId, output),
        }),
        ...createPiWriteTools({
          onApproval: ({ toolCallId }) => this.waitForToolApproval(command.sessionId, toolCallId),
        }),
        ...createPiImageTools(this.contentStorageRoot),
      ],
      cwd: this.contentStorageRoot,
      model,
      modelRuntime,
      resourceLoader,
      sessionManager,
      settingsManager,
      thinkingLevel: thinkingLevelFor(command.reasoningLevel ?? getActiveAgentReasoningLevel()),
      tools: [
        ...PI_BUILTIN_TOOL_NAMES,
        ...PI_READ_ONLY_TOOL_NAMES,
        ...PI_APPROVAL_TOOL_NAMES,
        ...PI_WEB_ACCESS_TOOL_NAMES,
        ...PI_IMAGE_TOOL_NAMES,
      ],
    });
    const globalSkillNames = resourceLoader
      .getSkills()
      .skills.map((skill) => skill.name)
      .filter((name) => !(PI_BUILTIN_SKILL_NAMES as readonly string[]).includes(name));
    return { ...created, modelConfig, globalSkillNames };
  }

  private handleCompactionEvent(
    event: PiAgentSessionEvent,
    manager: SessionManager,
    sessionId: string,
    contextWindow?: number,
    activeTurn?: {
      runId: string;
      messageId: string;
    },
  ): boolean {
    if (event.type === "compaction_start") {
      this.emitLive(
        this.createEvent({
          type: "context.compaction.started",
          sessionId,
          reason: event.reason,
        }),
      );
      return true;
    }

    if (event.type !== "compaction_end") return false;

    this.emitLive(
      this.createEvent({
        type: "context.compaction.finished",
        sessionId,
        reason: event.reason,
        ...(event.errorMessage ? { error: contextCompactionErrorMessage(event.errorMessage) } : {}),
      }),
    );
    if (!event.result) return true;

    const afterMessageId = activeTurn
      ? undefined
      : reduceAgentSession(this.sessionLog.eventsFromManager(manager)).messages.at(-1)?.id;
    const compacted = this.createEvent({
      type: "context.compacted",
      sessionId,
      ...(activeTurn ? { runId: activeTurn.runId, messageId: activeTurn.messageId } : {}),
      reason: event.reason,
      summary: event.result.summary,
      firstKeptEntryId: event.result.firstKeptEntryId,
      tokensBefore: event.result.tokensBefore,
      ...(event.result.estimatedTokensAfter !== undefined
        ? { estimatedTokensAfter: event.result.estimatedTokensAfter }
        : {}),
      ...(contextWindow !== undefined ? { contextWindow } : {}),
      ...(afterMessageId ? { afterMessageId } : {}),
    });
    this.appendAndPublish(manager, compacted);
    return true;
  }

  private async compactContext(
    command: Extract<AgentCommand, { type: "context.compact" }>,
  ): Promise<void> {
    if (this.activeRuns.has(command.sessionId) || this.activeCompactions.has(command.sessionId)) {
      throw new Error("当前对话正在处理中，请稍后再压缩上下文");
    }

    const manager = await this.sessionLog.openSession(command.sessionId);
    await this.sessionRuntime.replace(
      command.sessionId,
      this.sessionLog.eventsFromManager(manager),
    );
    const state = reduceAgentSession(this.sessionLog.eventsFromManager(manager));
    if (state.messages.length === 0) throw new Error("当前对话还没有可压缩的内容");

    const entityCatalog = new AgentEntityCatalog(state.entityCatalog);
    const created = await this.createSession(command, manager, entityCatalog, async () => ({
      approved: false,
      reason: "上下文压缩期间不执行 Bash",
    }));
    const session = created.session;
    const unsubscribe = session.subscribe((event) => {
      this.handleCompactionEvent(event, manager, command.sessionId, session.model?.contextWindow);
    });
    this.activeCompactions.set(command.sessionId, session);
    try {
      await session.compact();
    } catch (error) {
      const message = contextCompactionErrorMessage(formatAgentError(error));
      throw new Error(message);
    } finally {
      unsubscribe();
      session.dispose();
      this.activeCompactions.delete(command.sessionId);
    }
  }

  private createEvent<T extends AgentEvent["type"]>(
    input: Omit<Extract<AgentEvent, { type: T }>, "createdAt" | "id"> & {
      type: T;
    },
  ): Extract<AgentEvent, { type: T }> {
    return {
      ...input,
      id: `evt_${nanoid()}`,
      createdAt: new Date().toISOString(),
    } as Extract<AgentEvent, { type: T }>;
  }

  private appendAndPublish(manager: SessionManager, event: AgentSessionEvent): void {
    this.sessionLog.appendEvent(manager, event);
    this.sessionRuntime.apply(event);
  }

  private appendEntityCatalogUpdates(
    manager: SessionManager,
    sessionId: string,
    runId: string,
    registry: AgentEntityCatalog,
  ): void {
    const catalogUpdates = registry.drainUpdates();
    if (catalogUpdates.length === 0) return;
    this.appendAndPublish(
      manager,
      this.createEvent({
        type: "entity.catalog.updated",
        sessionId,
        runId,
        entries: catalogUpdates,
      }),
    );
  }

  private emitLive(event: AgentLiveEvent): void {
    this.sessionRuntime.apply(
      event,
      event.type === "assistant.text.delta" || event.type === "assistant.reasoning.delta"
        ? "deferred"
        : "immediate",
    );
  }

  private appendToolExecutionStarted(
    manager: SessionManager,
    requested: AgentApprovalRequested,
  ): void {
    this.appendAndPublish(
      manager,
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
    requested: AgentApprovalRequested,
    output: unknown,
  ): void {
    this.appendAndPublish(
      manager,
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
    requested: AgentApprovalRequested,
    error: unknown,
  ): void {
    this.appendAndPublish(
      manager,
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

  private async sendMessage(command: PiMessageCommand) {
    const runId = `run_${nanoid()}`;
    const userMessageId = command.messageId ?? `msg_${nanoid()}`;
    const assistantMessageId = `msg_${nanoid()}`;
    const manager = command.messageId
      ? await this.sessionLog.openSessionForEditedMessage(command.sessionId, command.messageId)
      : await this.sessionLog.openSession(command.sessionId);
    // Ensure the runtime entry exists before any apply()/replace() below (the
    // feed watch normally does this; direct callers rely on it too).
    await this.sessionRuntime.projection(command.sessionId);
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
    const requestedApprovalIds = new Set<string>();
    const emittedApprovalRequestIds = new Set<string>();
    const approvalRequestTasks: Promise<void>[] = [];
    const latestApprovalPreviewPayloads = new Map<string, Record<string, unknown>>();
    const hydratedApprovalPreviewPayloads = new Map<
      string,
      { entityId: string; payload: Record<string, unknown> }
    >();
    const approvalPreviewHydrationTasks = new Map<
      string,
      { entityId: string; task: Promise<Record<string, unknown>> }
    >();
    const emit = (event: AgentSessionEvent) => this.appendAndPublish(manager, event);
    const emitLive = (event: AgentLiveEvent) => this.emitLive(event);
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
    const checkpointForDecision = (requested: AgentApprovalRequested) => {
      const checkpoint = this.sessionRuntime.assistantTurn(
        this.createEvent({
          type: "assistant.turn",
          sessionId: command.sessionId,
          runId,
          messageId: assistantMessageId,
          blocks: [],
          text: "",
          ...assistantMetadata,
          contextUsage: session?.getContextUsage?.(),
        }),
        piDraftText,
      );
      const blocks = checkpoint.blocks.filter(
        (block) => block.kind !== "approval" || !block.preview,
      );
      const durableCheckpoint: AgentAssistantTurn = {
        ...checkpoint,
        blocks,
        text: blocks.flatMap((block) => (block.kind === "text" ? [block.text] : [])).join(""),
      };
      this.appendAndPublish(manager, durableCheckpoint);
      this.appendAndPublish(manager, requested);
    };
    const sendApprovalPreview = (
      toolCallId: string,
      toolName: PiApprovalToolName,
      payload: Record<string, unknown>,
    ) => {
      const approvalId = approvalIdForToolCall(toolCallId);
      const active = this.activeRuns.get(command.sessionId);
      if (
        emittedApprovalRequestIds.has(approvalId) ||
        this.cancelledRunIds.has(runId) ||
        active?.runId !== runId
      ) {
        return;
      }
      const preview = createApprovalRequested(toolCallId, toolName, payload, true);
      this.sessionRuntime.apply(preview);
    };
    const emitApprovalPreview = (
      toolCallId: string,
      toolName: PiApprovalToolName,
      payload: Record<string, unknown>,
      complete: boolean,
    ) => {
      const approvalId = approvalIdForToolCall(toolCallId);
      if (emittedApprovalRequestIds.has(approvalId)) return;
      latestApprovalPreviewPayloads.set(approvalId, payload);

      const entityId = previewEntityId(toolName, payload, complete);
      if (!entityId) {
        sendApprovalPreview(toolCallId, toolName, payload);
        return;
      }
      const hydrated = hydratedApprovalPreviewPayloads.get(approvalId);
      if (hydrated?.entityId === entityId) {
        sendApprovalPreview(
          toolCallId,
          toolName,
          mergeHydratedApprovalPayload(hydrated.payload, payload),
        );
        return;
      }
      const inFlight = approvalPreviewHydrationTasks.get(approvalId);
      if (inFlight?.entityId === entityId) return;

      const hydration = hydratePiApprovalPayload(toolName, payload).catch((error) => {
        agentLog.warn("pi.approval.previewHydrateFailed", {
          sessionId: command.sessionId,
          runId,
          toolName,
          toolCallId,
          error: formatAgentError(error),
        });
        return payload;
      });
      approvalPreviewHydrationTasks.set(approvalId, { entityId, task: hydration });
      const task = hydration.then((hydratedPayload) => {
        const latestPayload = latestApprovalPreviewPayloads.get(approvalId) ?? payload;
        if (approvalEntityId(toolName, latestPayload)?.value !== entityId) return;
        if (hasHydratedBefore(hydratedPayload)) {
          hydratedApprovalPreviewPayloads.set(approvalId, {
            entityId,
            payload: hydratedPayload,
          });
        } else if (approvalPreviewHydrationTasks.get(approvalId)?.task === hydration) {
          approvalPreviewHydrationTasks.delete(approvalId);
        }
        sendApprovalPreview(
          toolCallId,
          toolName,
          mergeHydratedApprovalPayload(hydratedPayload, latestPayload),
        );
      });
      approvalRequestTasks.push(task);
    };
    const emitApprovalRequest = (
      toolCallId: string,
      toolName: PiApprovalToolName,
      payload: Record<string, unknown>,
    ) => {
      const approvalId = approvalIdForToolCall(toolCallId);
      if (requestedApprovalIds.has(approvalId)) return;
      requestedApprovalIds.add(approvalId);
      const entityId = approvalEntityId(toolName, payload)?.value;
      const previewHydration = approvalPreviewHydrationTasks.get(approvalId);
      const hydration =
        entityId && previewHydration?.entityId === entityId
          ? previewHydration.task
          : hydratePiApprovalPayload(toolName, payload).catch((error) => {
              agentLog.warn("pi.approval.hydrateFailed", {
                sessionId: command.sessionId,
                runId,
                toolName,
                toolCallId,
                error: formatAgentError(error),
              });
              return payload;
            });
      const task = hydration.then((hydratedPayload) => {
        const requested = createApprovalRequested(
          toolCallId,
          toolName,
          mergeHydratedApprovalPayload(hydratedPayload, payload),
        );
        emittedApprovalRequestIds.add(approvalId);
        checkpointForDecision(requested);
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
      checkpointForDecision(requested);
      return this.waitForBashGateApproval(command.sessionId, toolCallId);
    };
    const emitEntityCatalogUpdates = () => {
      this.appendEntityCatalogUpdates(manager, command.sessionId, runId, entityCatalog);
    };
    const emitRunStarted = () => {
      if (runStarted) return;
      runStarted = true;
      emit(
        this.createEvent({
          type: "run.started",
          sessionId: command.sessionId,
          runId,
        }),
      );
      emitEntityCatalogUpdates();
      if (command.visibleUserMessage !== false) {
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
      }
    };

    try {
      // Regenerate/edit re-runs from a branch point: publish the run start and
      // the user question BEFORE the projection is replaced, then replace with
      // the complete (truncated + start) event list. Every published frame then
      // keeps the question visible; a single authoritative frame drops only the
      // old answer. Publishing the truncated state first (the previous order)
      // let the renderer paint a frame without the question between IPC frames.
      // Later call sites of emitRunStarted() are no-ops via the `runStarted` guard.
      emitRunStarted();
      await this.sessionRuntime.replace(
        command.sessionId,
        this.sessionLog.eventsFromManager(manager),
      );
      const created = await this.createSession(
        command,
        manager,
        entityCatalog,
        requestDangerousBashApproval,
      );
      session = created.session;
      this.activeRuns.set(command.sessionId, {
        runId,
        assistantMessageId,
        session,
        pendingApprovals: new Map(),
        entityCatalog,
      });
      unsubscribe = session.subscribe((event) => {
        if (this.cancelledRunIds.has(runId)) return;
        if (
          this.handleCompactionEvent(
            event,
            manager,
            command.sessionId,
            session?.model?.contextWindow,
            {
              runId,
              messageId: assistantMessageId,
            },
          )
        )
          return;

        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          piDraftText += event.assistantMessageEvent.delta;
          assistantActivity = true;
          emitLive(
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
          emitLive(
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
            emitApprovalPreview(
              toolCall.toolCallId,
              toolCall.toolName,
              toolCall.args,
              toolCall.complete,
            );
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
          emitLive(
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
              emitLive(
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
            emitLive(
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
          const resultError = piWebAccessResultError(event.toolName, event.result);
          if (event.isError || resultError) {
            emitLive(
              this.createEvent({
                type: "tool.failed",
                sessionId: command.sessionId,
                runId,
                messageId: assistantMessageId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                error: resultError ?? piToolError(event.result),
              }),
            );
            return;
          }
          emitEntityCatalogUpdates();
          emitLive(
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
          const error = extractPiAssistantError(event.message);
          if (error) {
            assistantError = error;
            return;
          }
        }

        if (event.type === "message_end" && !piDraftText) {
          const finalText = extractPiAssistantText(event.message);
          if (!finalText) return;
          piDraftText = finalText;
          assistantActivity = true;
        }
      });
      await session.prompt(
        buildPiPromptText({
          text: expandDollarSkillInvocation(command.text, created.globalSkillNames),
          contextRefs: command.contextRefs,
          contextCatalog,
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
      const contextUsage = session.getContextUsage?.();
      emit(
        this.sessionRuntime.assistantTurn(
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
          piDraftText,
        ),
      );
      emit(
        this.createEvent({
          type: "run.completed",
          sessionId: command.sessionId,
          runId,
        }),
      );
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
        this.sessionRuntime.assistantTurn(
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

  private waitForBashGateApproval(
    sessionId: string,
    toolCallId: string,
  ): Promise<{ approved: true } | { approved: false; reason?: string }> {
    const active = this.activeRuns.get(sessionId);
    if (!active) throw new Error("Approval requested without an active run");
    const approvalId = approvalIdForToolCall(toolCallId);
    if (active.pendingApprovals.has(approvalId)) {
      throw new Error(`Duplicate approval request: ${approvalId}`);
    }

    return new Promise<{ approved: true } | { approved: false; reason?: string }>(
      (resolve, reject) => {
        active.pendingApprovals.set(approvalId, {
          kind: "bash_gate",
          resolve,
          reject,
        });
      },
    ).finally(() => {
      this.activeRuns.get(sessionId)?.pendingApprovals.delete(approvalId);
    });
  }

  private rejectPendingApprovals(active: ActivePiRun, error: Error): void {
    for (const pending of active.pendingApprovals.values()) pending.reject(error);
    active.pendingApprovals.clear();
  }

  private async continueAfterDecision(
    manager: SessionManager,
    command: Extract<AgentCommand, { type: "tool.approve" | "tool.reject" }>,
    requested: AgentApprovalRequested,
    result: { approved: boolean; outcome?: unknown; error?: string; rejectionReason?: string },
  ): Promise<void> {
    const branch = manager.getBranch();
    const hasToolCall = branch.some(
      (entry) =>
        entry.type === "message" &&
        entry.message.role === "assistant" &&
        entry.message.content.some(
          (part) => part.type === "toolCall" && part.id === requested.toolCallId,
        ),
    );
    const hasToolResult = branch.some(
      (entry) =>
        entry.type === "message" &&
        entry.message.role === "toolResult" &&
        entry.message.toolCallId === requested.toolCallId,
    );
    if (hasToolCall && !hasToolResult) {
      const text = result.error
        ? `The action failed: ${result.error}`
        : result.approved
          ? `The action result is: ${JSON.stringify(result.outcome ?? null)}`
          : result.rejectionReason
            ? `The user rejected the action: ${result.rejectionReason}`
            : "The user rejected the action.";
      manager.appendMessage({
        role: "toolResult",
        toolCallId: requested.toolCallId,
        toolName: requested.toolName,
        content: [{ type: "text", text }],
        ...(result.outcome !== undefined ? { details: result.outcome } : {}),
        isError: Boolean(result.error),
        timestamp: Date.now(),
      });
    }
    await this.sendMessage({
      type: "message.send",
      sessionId: command.sessionId,
      text: approvalContinuationPrompt({ requested, ...result }),
      modelSelection: command.modelSelection,
      reasoningLevel: command.reasoningLevel,
      visibleUserMessage: false,
    });
  }

  private async resolveToolApproval(
    command: Extract<AgentCommand, { type: "tool.approve" | "tool.reject" }>,
  ) {
    const manager = await this.sessionLog.openSession(command.sessionId);
    const events = await this.sessionLog.readEvents(command.sessionId);
    await this.sessionRuntime.projection(command.sessionId);
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
    const rejectionReason =
      command.type === "tool.reject" ? command.reason?.trim() || undefined : undefined;
    const resolved = this.createEvent({
      type: "approval.resolved",
      sessionId: command.sessionId,
      runId: requested.runId,
      messageId: requested.messageId,
      approvalId: requested.approvalId,
      toolCallId: requested.toolCallId,
      toolName: requested.toolName,
      approved,
      ...(rejectionReason ? { rejectionReason } : {}),
    });
    this.appendAndPublish(manager, resolved);
    const active = this.activeRuns.get(command.sessionId);
    const pending =
      active?.runId === requested.runId
        ? active.pendingApprovals.get(requested.approvalId)
        : undefined;

    if (pending?.kind === "bash_gate") {
      pending.resolve(
        approved
          ? { approved: true }
          : {
              approved: false,
              ...(rejectionReason ? { reason: rejectionReason } : {}),
            },
      );
      return;
    }

    if (pending && active) {
      if (!isPiApprovalToolName(requested.toolName)) {
        const error = new Error(`Unsupported approval tool: ${requested.toolName}`);
        pending.reject(error);
        return;
      }
      if (!approved) {
        pending.resolve(rejectedToolResult(requested.toolName, rejectionReason));
        return;
      }
      this.appendToolExecutionStarted(manager, requested);
      void this.executeApprovedTool(requested, active.entityCatalog).then(
        (output) => {
          this.appendEntityCatalogUpdates(
            manager,
            requested.sessionId,
            requested.runId,
            active.entityCatalog,
          );
          this.appendToolExecutionCompleted(manager, requested, output);
          pending.resolve(output);
        },
        (error) => {
          this.appendToolExecutionFailed(manager, requested, error);
          pending.reject(error);
        },
      );
      return;
    }

    if (!approved) {
      await this.continueAfterDecision(manager, command, requested, {
        approved: false,
        rejectionReason,
      });
      return;
    }

    const existingTurn = events.findLast(
      (event): event is Extract<AgentSessionEvent, { type: "assistant.turn" }> =>
        event.type === "assistant.turn" && event.messageId === requested.messageId,
    );
    try {
      this.appendToolExecutionStarted(manager, requested);
      const registry = new AgentEntityCatalog(reduceAgentSession(events).entityCatalog);
      const output =
        requested.toolName === "bash"
          ? await this.executeApprovedBash(requested)
          : await this.executeApprovedTool(requested, registry);
      this.appendEntityCatalogUpdates(manager, requested.sessionId, requested.runId, registry);
      this.appendToolExecutionCompleted(manager, requested, output);
      this.appendAndPublish(
        manager,
        this.createEvent({
          type: "assistant.turn",
          sessionId: command.sessionId,
          runId: requested.runId,
          messageId: requested.messageId,
          text: existingTurn?.text ?? "",
          blocks: withApprovalToolResult(existingTurn?.blocks ?? [], requested, { output }),
        }),
      );
      await this.continueAfterDecision(manager, command, requested, {
        approved: true,
        outcome: output,
      });
    } catch (error) {
      this.appendToolExecutionFailed(manager, requested, error);
      this.appendAndPublish(
        manager,
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
      await this.continueAfterDecision(manager, command, requested, {
        approved: true,
        error: formatAgentError(error),
      });
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

  private async executeApprovedBash(requested: AgentApprovalRequested): Promise<unknown> {
    const command = isRecord(requested.payload) ? requested.payload.command : undefined;
    if (typeof command !== "string" || !command.trim()) {
      throw new Error("危险 Bash 确认缺少待执行命令");
    }
    const execute = createPiBashTool(this.contentStorageRoot).execute as unknown as (
      toolCallId: string,
      params: { command: string },
    ) => Promise<unknown>;
    return piToolOutput("bash", await execute(requested.toolCallId, { command }));
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
      {
        kind: "tool_result",
        toolCallId: requested.toolCallId,
        toolName: requested.toolName,
      },
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
