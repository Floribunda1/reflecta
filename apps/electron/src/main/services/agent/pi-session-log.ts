import fs from "node:fs";
import path from "node:path";
import {
  SessionManager,
  type CustomEntry,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { AgentSessionEvent, AgentSessionSummary } from "@shared/agent";
import { isAgentSessionEvent, reduceAgentSession } from "@shared/agent";
import { writeDiagnosticEvent } from "../../logger";

export const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";

export function getPiAgentSessionsRoot(contentStorageRoot: string): string {
  return path.join(contentStorageRoot, "Sessions");
}

type ReflectaEventEntry = CustomEntry<AgentSessionEvent> & { data: AgentSessionEvent };
type ReflectaEventEntryOfType<T extends AgentSessionEvent["type"]> = ReflectaEventEntry & {
  data: Extract<AgentSessionEvent, { type: T }>;
};

function isReflectaEventEntry(entry: SessionEntry): entry is ReflectaEventEntry {
  return (
    entry.type === "custom" &&
    entry.customType === REFLECTA_AGENT_EVENT_ENTRY &&
    isAgentSessionEvent(entry.data)
  );
}

function isLegacyReflectaEventEntry(entry: SessionEntry): boolean {
  if (
    entry.type !== "custom" ||
    entry.customType !== REFLECTA_AGENT_EVENT_ENTRY ||
    !entry.data ||
    typeof entry.data !== "object" ||
    !("type" in entry.data)
  ) {
    return false;
  }
  return [
    "assistant.text.delta",
    "assistant.reasoning.delta",
    "tool.started",
    "tool.completed",
    "tool.failed",
  ].includes(String(entry.data.type));
}

function isReflectaEventEntryOfType<T extends AgentSessionEvent["type"]>(
  entry: SessionEntry,
  type: T,
): entry is ReflectaEventEntryOfType<T> {
  return isReflectaEventEntry(entry) && entry.data.type === type;
}

function titleFromEvents(events: AgentSessionEvent[], fallback: string) {
  const state = reduceAgentSession(events);
  const firstUserText = state.messages.find((message) => message.role === "user")?.text.trim();
  return firstUserText ? firstUserText.slice(0, 40) : fallback;
}

function compactAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attrs).filter(([, value]) => value !== undefined));
}

function stringField(event: AgentSessionEvent, key: string): string | undefined {
  const value = (event as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function booleanField(event: AgentSessionEvent, key: string): boolean | undefined {
  const value = (event as unknown as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : undefined;
}

function arrayLengthField(event: AgentSessionEvent, key: string): number | undefined {
  const value = (event as unknown as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : undefined;
}

function shouldMirrorAgentEvent(event: AgentSessionEvent): boolean {
  return event.type !== "assistant.turn";
}

function mirrorAgentEvent(event: AgentSessionEvent): void {
  if (!shouldMirrorAgentEvent(event)) return;
  const error = stringField(event, "error");
  writeDiagnosticEvent({
    level: error || event.type.endsWith(".failed") ? "error" : "info",
    event: `agent.${event.type}`,
    scope: "agent",
    context: compactAttrs({
      sessionId: event.sessionId,
      runId: stringField(event, "runId"),
      messageId: stringField(event, "messageId"),
      toolCallId: stringField(event, "toolCallId"),
    }),
    attrs: compactAttrs({
      agentEventType: event.type,
      approvalId: stringField(event, "approvalId"),
      approved: booleanField(event, "approved"),
      error,
      textLength: stringField(event, "text")?.length,
      contextRefCount: arrayLengthField(event, "contextRefs"),
      fileCount: arrayLengthField(event, "files"),
      toolName: stringField(event, "toolName"),
    }),
  });
}

type FlushablePiSessionInternals = {
  _rewriteFile?: () => void;
  flushed?: boolean;
};

export class AgentSessionLog {
  private readonly pendingSessionFiles = new Map<string, string>();
  private readonly pendingSummaries = new Map<string, AgentSessionSummary>();

  constructor(private readonly contentStorageRoot: string) {}

  get sessionsRoot() {
    return getPiAgentSessionsRoot(this.contentStorageRoot);
  }

  createSession(title = "新对话"): AgentSessionSummary {
    fs.mkdirSync(this.sessionsRoot, { recursive: true });
    const manager = SessionManager.create(this.contentStorageRoot, this.sessionsRoot);
    const sessionFile = manager.getSessionFile();
    if (sessionFile) this.pendingSessionFiles.set(manager.getSessionId(), sessionFile);
    const now = new Date().toISOString();
    const summary: AgentSessionSummary = {
      id: manager.getSessionId(),
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
      runtime: "pi",
    };
    this.pendingSummaries.set(summary.id, summary);
    return summary;
  }

  async listSessions(): Promise<AgentSessionSummary[]> {
    fs.mkdirSync(this.sessionsRoot, { recursive: true });
    const sessions = await SessionManager.list(this.contentStorageRoot, this.sessionsRoot);
    const persisted = sessions
      .flatMap((session) => {
        const events = this.readEventsFromFile(session.path, { allowLegacy: true });
        this.pendingSummaries.delete(session.id);
        if (!events.some((event) => event.type === "user.message")) return [];
        return {
          id: session.id,
          title: session.name?.trim() || titleFromEvents(events, session.firstMessage || "新对话"),
          status: "active" as const,
          createdAt: session.created.toISOString(),
          updatedAt: session.modified.toISOString(),
          runtime: "pi" as const,
        };
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return persisted;
  }

  async openSession(sessionId: string): Promise<SessionManager> {
    const pendingFile = this.pendingSessionFiles.get(sessionId);
    if (pendingFile) {
      if (fs.existsSync(pendingFile)) {
        return SessionManager.open(pendingFile, this.sessionsRoot, this.contentStorageRoot);
      }
      const manager = SessionManager.create(this.contentStorageRoot, this.sessionsRoot, {
        id: sessionId,
      });
      const sessionFile = manager.getSessionFile();
      if (sessionFile) this.pendingSessionFiles.set(sessionId, sessionFile);
      return manager;
    }

    const sessions = await SessionManager.list(this.contentStorageRoot, this.sessionsRoot);
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error("Pi session not found");
    this.pendingSessionFiles.set(sessionId, session.path);
    return SessionManager.open(session.path, this.sessionsRoot, this.contentStorageRoot);
  }

  async openSessionForEditedMessage(sessionId: string, messageId: string): Promise<SessionManager> {
    const manager = await this.openSession(sessionId);
    const entries = manager.getEntries();
    const userEntry = entries.findLast(
      (entry) =>
        isReflectaEventEntryOfType(entry, "user.message") && entry.data.messageId === messageId,
    ) as ReflectaEventEntryOfType<"user.message"> | undefined;
    if (!userEntry) throw new Error("Edited message not found");
    const editedRunId = userEntry.data.runId;

    const runEntry = entries.findLast(
      (entry) =>
        isReflectaEventEntryOfType(entry, "run.started") && entry.data.runId === editedRunId,
    );
    const branchFromId = runEntry ? runEntry.parentId : userEntry.parentId;
    if (branchFromId) manager.branch(branchFromId);
    else manager.resetLeaf();
    return manager;
  }

  async forkSessionFromAssistantMessage(
    sessionId: string,
    messageId: string,
  ): Promise<AgentSessionSummary> {
    const manager = await this.openSession(sessionId);
    const entries = manager.getEntries();
    const messageEntries = entries.filter(
      (entry): entry is ReflectaEventEntry =>
        isReflectaEventEntry(entry) && stringField(entry.data, "messageId") === messageId,
    );
    const lastMessageEntry = messageEntries.at(-1);
    const runId = lastMessageEntry ? stringField(lastMessageEntry.data, "runId") : undefined;
    if (!runId) throw new Error("Assistant message not found");
    const completedEntry = entries.findLast(
      (entry) =>
        isReflectaEventEntryOfType(entry, "run.completed") &&
        stringField(entry.data, "runId") === runId,
    );
    const branchEntry = completedEntry ?? lastMessageEntry;
    if (!branchEntry) throw new Error("Cannot fork assistant message");

    const sourceEvents = await this.readEvents(sessionId);
    const title = `${manager.getSessionName()?.trim() || titleFromEvents(sourceEvents, "新对话")} 分支`;
    manager.createBranchedSession(branchEntry.id);
    this.flushCustomOnlySession(manager);
    manager.appendSessionInfo(title);

    const forkedSessionId = manager.getSessionId();
    const sessionFile = manager.getSessionFile();
    if (sessionFile) {
      this.rewriteReflectaEventSessionIds(sessionFile, forkedSessionId);
      this.pendingSessionFiles.set(forkedSessionId, sessionFile);
    }

    const now = new Date().toISOString();
    return {
      id: forkedSessionId,
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
      runtime: "pi",
    };
  }

  appendEvent(manager: SessionManager, event: AgentSessionEvent): void {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
    mirrorAgentEvent(event);
    this.flushCustomOnlySession(manager);
    const sessionFile = manager.getSessionFile();
    if (sessionFile) this.pendingSessionFiles.set(manager.getSessionId(), sessionFile);
    const pending = this.pendingSummaries.get(event.sessionId);
    if (pending) {
      this.pendingSummaries.set(event.sessionId, {
        ...pending,
        title:
          event.type === "user.message" && pending.title === "新对话"
            ? event.text.slice(0, 40)
            : pending.title,
        updatedAt: event.createdAt,
      });
    }
  }

  eventsFromManager(manager: SessionManager): AgentSessionEvent[] {
    return manager
      .getEntries()
      .filter(isReflectaEventEntry)
      .flatMap((entry) => (entry.data ? [entry.data] : []));
  }

  private flushCustomOnlySession(manager: SessionManager): void {
    const sessionFile = manager.getSessionFile();
    if (!sessionFile) return;
    const flushable = manager as unknown as FlushablePiSessionInternals;
    if (flushable.flushed === true && fs.existsSync(sessionFile)) return;
    if (typeof flushable._rewriteFile !== "function") {
      throw new Error("Pi SessionManager flush hook is unavailable");
    }
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    flushable._rewriteFile();
    flushable.flushed = true;
  }

  private rewriteReflectaEventSessionIds(sessionFile: string, sessionId: string): void {
    if (!fs.existsSync(sessionFile)) return;
    let changed = false;
    const lines = fs
      .readFileSync(sessionFile, "utf-8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const entry = JSON.parse(line) as SessionEntry;
        if (isReflectaEventEntry(entry) && entry.data.sessionId !== sessionId) {
          entry.data = { ...entry.data, sessionId };
          changed = true;
        }
        return JSON.stringify(entry);
      });
    if (changed) fs.writeFileSync(sessionFile, `${lines.join("\n")}\n`, "utf-8");
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    const manager = await this.openSession(sessionId);
    manager.appendSessionInfo(title);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const pendingFile = this.pendingSessionFiles.get(sessionId);
    const sessions = pendingFile
      ? [{ id: sessionId, path: pendingFile }]
      : await SessionManager.list(this.contentStorageRoot, this.sessionsRoot);
    const session = sessions.find((item) => item.id === sessionId);
    if (session?.path) fs.rmSync(session.path, { force: true });
    this.pendingSessionFiles.delete(sessionId);
    this.pendingSummaries.delete(sessionId);
  }

  async readEvents(sessionId: string): Promise<AgentSessionEvent[]> {
    const pendingFile = this.pendingSessionFiles.get(sessionId);
    if (pendingFile && fs.existsSync(pendingFile)) return this.readEventsFromFile(pendingFile);

    const sessions = await SessionManager.list(this.contentStorageRoot, this.sessionsRoot);
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return [];
    this.pendingSessionFiles.set(sessionId, session.path);
    return this.readEventsFromFile(session.path);
  }

  private readEventsFromFile(
    sessionFile: string,
    options: { allowLegacy?: boolean } = {},
  ): AgentSessionEvent[] {
    if (!fs.existsSync(sessionFile)) return [];
    const manager = SessionManager.open(sessionFile, this.sessionsRoot, this.contentStorageRoot);
    const entries = manager.getEntries();
    if (!options.allowLegacy && entries.some(isLegacyReflectaEventEntry)) {
      throw new Error("Legacy Agent session format found. This session must be migrated first.");
    }
    return this.eventsFromManager(manager);
  }
}
