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

const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";
const SESSION_INDEX_FILE = "sessions-index.json";
const SESSION_INDEX_VERSION = 1;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function errorField(event: AgentSessionEvent): unknown {
  const value = (event as unknown as Record<string, unknown>).error;
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  return compactAttrs({
    message: typeof value.message === "string" ? value.message : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
    details: isRecord(value.details) ? value.details : undefined,
  });
}

function shouldMirrorAgentEvent(event: AgentSessionEvent): boolean {
  return event.type !== "assistant.turn";
}

function mirrorAgentEvent(event: AgentSessionEvent): void {
  if (!shouldMirrorAgentEvent(event)) return;
  const error = errorField(event);
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

type IndexedSessionSummary = AgentSessionSummary & { fileName: string };

type SessionIndex = {
  version: typeof SESSION_INDEX_VERSION;
  files: string[];
  sessions: IndexedSessionSummary[];
};

function emptySessionIndex(): SessionIndex {
  return { version: SESSION_INDEX_VERSION, files: [], sessions: [] };
}

function isIndexedSessionSummary(value: unknown): value is IndexedSessionSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    value.status === "active" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    value.runtime === "pi" &&
    typeof value.fileName === "string" &&
    path.basename(value.fileName) === value.fileName
  );
}

function parseSessionIndex(value: unknown): SessionIndex | undefined {
  if (
    !isRecord(value) ||
    value.version !== SESSION_INDEX_VERSION ||
    !Array.isArray(value.files) ||
    !Array.isArray(value.sessions) ||
    !value.files.every(
      (fileName) => typeof fileName === "string" && path.basename(fileName) === fileName,
    ) ||
    !value.sessions.every(isIndexedSessionSummary)
  ) {
    return undefined;
  }
  return value as SessionIndex;
}

export class AgentSessionLog {
  private readonly pendingSessionFiles = new Map<string, string>();
  private readonly pendingSummaries = new Map<string, AgentSessionSummary>();

  constructor(private readonly contentStorageRoot: string) {}

  get sessionsRoot() {
    return getPiAgentSessionsRoot(this.contentStorageRoot);
  }

  private get sessionIndexPath() {
    return path.join(this.sessionsRoot, SESSION_INDEX_FILE);
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
    const cached = this.readSessionIndex();
    const index =
      cached && this.isSessionIndexCurrent(cached) ? cached : await this.rebuildSessionIndex();
    for (const session of index.sessions) this.pendingSummaries.delete(session.id);
    return index.sessions
      .map((summary) => ({
        id: summary.id,
        title: summary.title,
        status: summary.status,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        runtime: summary.runtime,
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async rebuildSessionIndex(): Promise<SessionIndex> {
    const sessions = await SessionManager.list(this.contentStorageRoot, this.sessionsRoot);
    const index: SessionIndex = {
      ...emptySessionIndex(),
      files: fs.readdirSync(this.sessionsRoot).filter((name) => name.endsWith(".jsonl")),
    };
    for (const session of sessions) {
      const events = this.readEventsFromFile(session.path);
      if (events.some((event) => event.type === "user.message")) {
        this.pendingSummaries.delete(session.id);
        index.sessions.push({
          id: session.id,
          title: session.name?.trim() || titleFromEvents(events, session.firstMessage || "新对话"),
          status: "active" as const,
          createdAt: session.created.toISOString(),
          updatedAt: new Date(
            Math.max(session.created.getTime(), session.modified.getTime()),
          ).toISOString(),
          runtime: "pi" as const,
          fileName: path.basename(session.path),
        });
      }
    }
    this.writeSessionIndex(index);
    return index;
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

    const sessionFile = this.findSessionFile(sessionId);
    if (!sessionFile) throw new Error("Pi session not found");
    this.pendingSessionFiles.set(sessionId, sessionFile);
    return SessionManager.open(sessionFile, this.sessionsRoot, this.contentStorageRoot);
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
    const title = `Fork - ${manager.getSessionName()?.trim() || titleFromEvents(sourceEvents, "新对话")}`;
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
    const summary: AgentSessionSummary = {
      id: forkedSessionId,
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
      runtime: "pi",
    };
    if (sessionFile) this.upsertIndexedSession(summary, sessionFile);
    return summary;
  }

  appendEvent(manager: SessionManager, event: AgentSessionEvent): void {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
    mirrorAgentEvent(event);
    this.flushCustomOnlySession(manager);
    const sessionFile = manager.getSessionFile();
    if (sessionFile) this.pendingSessionFiles.set(manager.getSessionId(), sessionFile);
    const pending = this.pendingSummaries.get(event.sessionId);
    if (event.type === "run.started" && pending && sessionFile) {
      this.ensureIndexedFile(sessionFile);
    }
    let summary = pending;
    if (pending) {
      summary = {
        ...pending,
        title:
          event.type === "user.message" && pending.title === "新对话"
            ? event.text.slice(0, 40)
            : pending.title,
        updatedAt: event.createdAt,
      };
      this.pendingSummaries.set(event.sessionId, summary);
    } else if (event.type === "user.message") {
      const indexed = this.readSessionIndex()?.sessions.find(
        (session) => session.id === event.sessionId,
      );
      if (indexed) summary = { ...indexed, updatedAt: event.createdAt };
    }
    if (event.type === "user.message" && summary && sessionFile) {
      this.upsertIndexedSession(summary, sessionFile);
    }
  }

  eventsFromManager(manager: SessionManager): AgentSessionEvent[] {
    return manager
      .getBranch()
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
    const pending = this.pendingSummaries.get(sessionId);
    if (pending) this.pendingSummaries.set(sessionId, { ...pending, title });
    const index = this.readSessionIndex();
    const indexed = index?.sessions.findIndex((session) => session.id === sessionId) ?? -1;
    if (index && indexed >= 0) {
      index.sessions[indexed] = { ...index.sessions[indexed], title };
      this.writeSessionIndex(index);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionFile = this.findSessionFile(sessionId);
    if (sessionFile) fs.rmSync(sessionFile, { force: true });
    this.pendingSessionFiles.delete(sessionId);
    this.pendingSummaries.delete(sessionId);
    const index = this.readSessionIndex();
    if (index) {
      index.sessions = index.sessions.filter((session) => session.id !== sessionId);
      if (sessionFile) {
        index.files = index.files.filter((fileName) => fileName !== path.basename(sessionFile));
      }
      this.writeSessionIndex(index);
    }
  }

  async readEvents(sessionId: string): Promise<AgentSessionEvent[]> {
    const sessionFile = this.findSessionFile(sessionId);
    if (!sessionFile) return [];
    this.pendingSessionFiles.set(sessionId, sessionFile);
    return this.readEventsFromFile(sessionFile);
  }

  private findSessionFile(sessionId: string): string | undefined {
    const pendingFile = this.pendingSessionFiles.get(sessionId);
    if (pendingFile && fs.existsSync(pendingFile)) return pendingFile;

    const indexedFileName = this.readSessionIndex()?.sessions.find(
      (session) => session.id === sessionId,
    )?.fileName;
    if (indexedFileName) {
      const indexedFile = path.join(this.sessionsRoot, indexedFileName);
      if (fs.existsSync(indexedFile)) return indexedFile;
    }

    if (!fs.existsSync(this.sessionsRoot)) return undefined;
    const suffix = `_${sessionId}.jsonl`;
    const fileName = fs.readdirSync(this.sessionsRoot).find((name) => name.endsWith(suffix));
    return fileName ? path.join(this.sessionsRoot, fileName) : undefined;
  }

  private readSessionIndex(): SessionIndex | undefined {
    if (!fs.existsSync(this.sessionIndexPath)) return undefined;
    try {
      return parseSessionIndex(JSON.parse(fs.readFileSync(this.sessionIndexPath, "utf-8")));
    } catch {
      return undefined;
    }
  }

  private isSessionIndexCurrent(index: SessionIndex): boolean {
    const sessionFiles = new Set(
      fs
        .readdirSync(this.sessionsRoot)
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => path.basename(name)),
    );
    const knownFiles = new Set(index.files);
    return (
      sessionFiles.size === knownFiles.size &&
      Array.from(sessionFiles).every((fileName) => knownFiles.has(fileName))
    );
  }

  private writeSessionIndex(index: SessionIndex): void {
    fs.mkdirSync(this.sessionsRoot, { recursive: true });
    const temporaryPath = `${this.sessionIndexPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(index), "utf-8");
    fs.renameSync(temporaryPath, this.sessionIndexPath);
  }

  private upsertIndexedSession(summary: AgentSessionSummary, sessionFile: string): void {
    const index = this.readSessionIndex();
    if (!index) {
      if (fs.existsSync(this.sessionIndexPath)) fs.rmSync(this.sessionIndexPath, { force: true });
      return;
    }
    const indexed = index.sessions.findIndex((session) => session.id === summary.id);
    const nextSummary = {
      ...summary,
      fileName: path.basename(sessionFile),
    };
    if (indexed >= 0) index.sessions[indexed] = nextSummary;
    else index.sessions.push(nextSummary);
    if (!index.files.includes(nextSummary.fileName)) index.files.push(nextSummary.fileName);
    this.writeSessionIndex(index);
  }

  private ensureIndexedFile(sessionFile: string): void {
    const index = this.readSessionIndex();
    if (!index) return;
    const fileName = path.basename(sessionFile);
    if (index.files.includes(fileName)) return;
    index.files.push(fileName);
    this.writeSessionIndex(index);
  }

  private readEventsFromFile(sessionFile: string): AgentSessionEvent[] {
    if (!fs.existsSync(sessionFile)) return [];
    const manager = SessionManager.open(sessionFile, this.sessionsRoot, this.contentStorageRoot);
    return this.eventsFromManager(manager);
  }
}
