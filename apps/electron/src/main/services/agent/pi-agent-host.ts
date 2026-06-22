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
import { getAiModelConfig, getContentStorageRoot, type AiModelSelection } from "../../config";
import type {
  AgentCommand,
  AgentReasoningLevel,
  AgentSessionEvent,
  AgentSessionSummary,
} from "@shared/agent";
import { agentLog } from "../../logger";
import { AgentSessionLog } from "./pi-session-log";
import { formatAgentError } from "./error";
import { buildPiPromptText } from "./pi-prompt";

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
      "You are Reflecta's agent. Answer the user's message clearly and concisely.",
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

export function isPiAgentRuntimeEnabled() {
  return process.env.REFLECTA_AGENT_RUNTIME === "pi";
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
  }

  private async createSession(
    command: Extract<AgentCommand, { type: "message.send" }>,
    sessionManager: SessionManager,
  ) {
    const modelConfig = getAiModelConfig(command.modelSelection as AiModelSelection | undefined);
    const agentDir = path.join(this.contentStorageRoot, ".pi-agent");
    fs.mkdirSync(agentDir, { recursive: true });
    const authStorage = AuthStorage.create(path.join(agentDir, "auth.json"));
    authStorage.setRuntimeApiKey(modelConfig.provider.id, modelConfig.provider.apiKey);
    const modelRegistry = ModelRegistry.inMemory(authStorage);
    const model = resolvePiModel(modelConfig.provider.id, modelConfig.model.id);
    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: false },
    });

    return createAgentSession({
      agentDir,
      authStorage,
      cwd: this.contentStorageRoot,
      model,
      modelRegistry,
      noTools: "all",
      resourceLoader: createPiResourceLoader(),
      sessionManager,
      settingsManager,
      thinkingLevel: thinkingLevelFor(command.reasoningLevel),
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

        if (event.type === "message_end" && !assistantText) {
          const finalText = extractAssistantText(event.message);
          if (!finalText) return;
          assistantText = finalText;
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
      if (!assistantText.trim()) {
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
}
