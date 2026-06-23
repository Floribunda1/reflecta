import fs from "node:fs";
import path from "node:path";
import type { WebContents } from "electron";
import { getModel, type Api, type Model } from "@earendil-works/pi-ai";
import {
  AuthStorage,
  createAgentSession,
  createExtensionRuntime,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { nanoid } from "nanoid";
import {
  getAiModelConfig,
  getContentStorageRoot,
  type AiModelSelection,
  type ResolvedAiModelConfig,
} from "../../config";
import type {
  AgentCommand,
  AgentReasoningLevel,
  AgentApprovalRequested,
  AgentSessionEvent,
  AgentSessionSummary,
} from "@shared/agent";
import { agentLog } from "../../logger";
import { AgentSessionLog } from "./pi-session-log";
import { formatAgentError } from "./error";
import { buildPiPromptText } from "./pi-prompt";
import { getCodexCredentials } from "./codex-auth";
import { createPiReadOnlyTools, PI_READ_ONLY_TOOL_NAMES } from "./pi-readonly-tools";
import {
  approvalTitleForTool,
  createPiWriteTools,
  executePiApprovedTool,
  isPiApprovalToolName,
  PI_APPROVAL_TOOL_NAMES,
} from "./pi-write-tools";

export const AGENT_EVENT_CHANNEL = "agent:event";

type ActivePiRun = {
  runId: string;
  session: AgentSession;
};

function createPiResourceLoader(): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () =>
      [
        "You are Reflecta's agent. Answer the user's message clearly and concisely.",
        "When the user asks to search, inspect, or read Reflecta knowledge, use the provided Reflecta read-only tools before answering.",
        "Do not invent knowledge-base search results. Base those answers on tool results.",
        "When the user asks to create, update, or delete Reflecta knowledge, call the matching approval tool. Do not replace an approval tool call with a prose-only proposal.",
        "Approval tools only create pending proposals. Reflecta writes to the knowledge base only after the user confirms in the UI.",
        "If the user explicitly names a tool, call that tool unless the request is impossible or unsafe.",
      ].join("\n"),
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
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
  if (!level || level === "default") return "off";
  return level;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function piToolOutput(result: unknown): unknown {
  return isRecord(result) && "details" in result ? result.details : result;
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

function approvalIdForToolCall(toolCallId: string) {
  return `approval_${toolCallId}`;
}

export async function configurePiRuntimeAuth(
  authStorage: AuthStorage,
  modelConfig: ResolvedAiModelConfig,
): Promise<void> {
  const apiKey =
    modelConfig.catalog.authType === "codex"
      ? (await getCodexCredentials()).accessToken
      : modelConfig.provider.apiKey;
  authStorage.setRuntimeApiKey(modelConfig.provider.id, apiKey);
}

export class PiAgentHost {
  private readonly sessionLog: AgentSessionLog;
  private readonly activeRuns = new Map<string, ActivePiRun>();
  private readonly cancelledRunIds = new Set<string>();

  constructor(private readonly contentStorageRoot = getContentStorageRoot()) {
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

  async generateThreadTitle(sessionId: string): Promise<string> {
    const events = await this.sessionLog.readEvents(sessionId);
    const firstUserMessage = events.find((event) => event.type === "user.message");
    const title =
      firstUserMessage?.type === "user.message" ? firstUserMessage.text.slice(0, 40) : "新对话";
    await this.renameThread(sessionId, title);
    return title;
  }

  readSessionEvents(sessionId: string): Promise<AgentSessionEvent[]> {
    return this.sessionLog.readEvents(sessionId);
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
  ) {
    const modelConfig = getAiModelConfig(command.modelSelection as AiModelSelection | undefined);
    const agentDir = path.join(this.contentStorageRoot, ".pi-agent");
    fs.mkdirSync(agentDir, { recursive: true });
    const authStorage = AuthStorage.create(path.join(agentDir, "auth.json"));
    await configurePiRuntimeAuth(authStorage, modelConfig);
    const modelRegistry = ModelRegistry.inMemory(authStorage);
    const model = resolvePiModel(modelConfig.provider.id, modelConfig.model.id);
    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: false },
    });

    return createAgentSession({
      agentDir,
      authStorage,
      customTools: [...createPiReadOnlyTools(), ...createPiWriteTools()],
      cwd: this.contentStorageRoot,
      model,
      modelRegistry,
      resourceLoader: createPiResourceLoader(),
      sessionManager,
      settingsManager,
      thinkingLevel: thinkingLevelFor(command.reasoningLevel),
      tools: [...PI_READ_ONLY_TOOL_NAMES, ...PI_APPROVAL_TOOL_NAMES],
    });
  }

  private createEvent<T extends AgentSessionEvent["type"]>(
    input: Omit<Extract<AgentSessionEvent, { type: T }>, "createdAt" | "id"> & { type: T },
  ): Extract<AgentSessionEvent, { type: T }> {
    return {
      ...input,
      id: `evt_${nanoid()}`,
      createdAt: new Date().toISOString(),
    } as Extract<AgentSessionEvent, { type: T }>;
  }

  private appendAndEmit(
    manager: SessionManager,
    webContents: WebContents,
    event: AgentSessionEvent,
  ): void {
    this.sessionLog.appendEvent(manager, event);
    if (!webContents.isDestroyed()) webContents.send(AGENT_EVENT_CHANNEL, event);
  }

  private async sendMessage(
    command: Extract<AgentCommand, { type: "message.send" }>,
    webContents: WebContents,
  ) {
    const runId = `run_${nanoid()}`;
    const userMessageId = `msg_${nanoid()}`;
    const assistantMessageId = `msg_${nanoid()}`;
    const manager = await this.sessionLog.openSession(command.sessionId);
    let session: AgentSession | undefined;
    let unsubscribe: (() => void) | undefined;
    let assistantText = "";
    let assistantActivity = false;
    let runStarted = false;
    const emit = (event: AgentSessionEvent) => this.appendAndEmit(manager, webContents, event);
    const emitRunStarted = () => {
      if (runStarted) return;
      runStarted = true;
      emit(this.createEvent({ type: "run.started", sessionId: command.sessionId, runId }));
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
      const created = await this.createSession(command, manager);
      session = created.session;
      this.activeRuns.set(command.sessionId, { runId, session });
      unsubscribe = session.subscribe((event) => {
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          assistantText += event.assistantMessageEvent.delta;
          assistantActivity = true;
          emit(
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
          emit(
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

        if (event.type === "tool_execution_start") {
          assistantActivity = true;
          if (isPiApprovalToolName(event.toolName)) {
            emit(
              this.createEvent({
                type: "approval.requested",
                sessionId: command.sessionId,
                runId,
                messageId: assistantMessageId,
                approvalId: approvalIdForToolCall(event.toolCallId),
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                title: approvalTitleForTool(event.toolName),
                payload: event.args,
              }),
            );
            return;
          }
          emit(
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
            if (event.isError) {
              emit(
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
            }
            return;
          }
          if (event.isError) {
            emit(
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
          emit(
            this.createEvent({
              type: "tool.completed",
              sessionId: command.sessionId,
              runId,
              messageId: assistantMessageId,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              output: piToolOutput(event.result),
            }),
          );
          return;
        }

        if (event.type === "message_end" && !assistantText) {
          const finalText = extractAssistantText(event.message);
          if (!finalText) return;
          assistantText = finalText;
          assistantActivity = true;
          emit(
            this.createEvent({
              type: "assistant.text.delta",
              sessionId: command.sessionId,
              runId,
              messageId: assistantMessageId,
              delta: finalText,
            }),
          );
        }
      });
      emitRunStarted();
      await session.prompt(
        buildPiPromptText({
          text: command.text,
          contextRefs: command.contextRefs,
          files: command.files,
        }),
      );
      if (this.cancelledRunIds.has(runId)) return;
      if (!assistantText.trim() && !assistantActivity) {
        emit(
          this.createEvent({
            type: "run.failed",
            sessionId: command.sessionId,
            runId,
            error: "Agent response was empty",
          }),
        );
        return;
      }
      emit(this.createEvent({ type: "run.completed", sessionId: command.sessionId, runId }));
    } catch (error) {
      emitRunStarted();
      if (this.cancelledRunIds.has(runId)) return;
      emit(
        this.createEvent({
          type: "run.failed",
          sessionId: command.sessionId,
          runId,
          error: formatAgentError(error),
        }),
      );
    } finally {
      unsubscribe?.();
      session?.dispose();
      this.cancelledRunIds.delete(runId);
      this.activeRuns.delete(command.sessionId);
    }
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
    this.appendAndEmit(
      manager,
      webContents,
      this.createEvent({
        type: "approval.resolved",
        sessionId: command.sessionId,
        runId: requested.runId,
        messageId: requested.messageId,
        approvalId: requested.approvalId,
        toolCallId: requested.toolCallId,
        toolName: requested.toolName,
        approved,
      }),
    );
    if (!approved) return;

    try {
      const output = await this.executeApprovedTool(requested);
      this.appendAndEmit(
        manager,
        webContents,
        this.createEvent({
          type: "tool.completed",
          sessionId: command.sessionId,
          runId: requested.runId,
          messageId: requested.messageId,
          toolCallId: requested.toolCallId,
          toolName: requested.toolName,
          output,
        }),
      );
    } catch (error) {
      this.appendAndEmit(
        manager,
        webContents,
        this.createEvent({
          type: "tool.failed",
          sessionId: command.sessionId,
          runId: requested.runId,
          messageId: requested.messageId,
          toolCallId: requested.toolCallId,
          toolName: requested.toolName,
          error: formatAgentError(error),
        }),
      );
    }
  }

  private async executeApprovedTool(requested: AgentApprovalRequested): Promise<unknown> {
    if (!isPiApprovalToolName(requested.toolName)) {
      throw new Error(`Unsupported approval tool: ${requested.toolName}`);
    }
    return executePiApprovedTool(requested.toolName, requested.payload);
  }
}
