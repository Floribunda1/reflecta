import fs from "node:fs";
import path from "node:path";
import {
  SessionManager,
  type CustomEntry,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { AgentSessionEvent, AgentSessionSummary } from "@shared/agent";
import { isAgentSessionEvent, reduceAgentSession } from "@shared/agent";

export const REFLECTA_AGENT_EVENT_ENTRY = "reflecta.agent.event";

export function getPiAgentSessionsRoot(contentStorageRoot: string): string {
  return path.join(contentStorageRoot, "Sessions");
}

function isReflectaEventEntry(entry: SessionEntry): entry is CustomEntry<AgentSessionEvent> {
  return (
    entry.type === "custom" &&
    entry.customType === REFLECTA_AGENT_EVENT_ENTRY &&
    isAgentSessionEvent(entry.data)
  );
}

function titleFromEvents(events: AgentSessionEvent[], fallback: string) {
  const state = reduceAgentSession(events);
  const firstUserText = state.messages.find((message) => message.role === "user")?.text.trim();
  return firstUserText ? firstUserText.slice(0, 40) : fallback;
}

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
      .map((session) => {
        const events = this.readEventsFromFile(session.path);
        this.pendingSummaries.delete(session.id);
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
    const pending = [...this.pendingSummaries.values()].filter((summary) => {
      const sessionFile = this.pendingSessionFiles.get(summary.id);
      return !sessionFile || !fs.existsSync(sessionFile);
    });
    return [...pending, ...persisted].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
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

  appendEvent(manager: SessionManager, event: AgentSessionEvent): void {
    manager.appendCustomEntry(REFLECTA_AGENT_EVENT_ENTRY, event);
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

  private readEventsFromFile(sessionFile: string): AgentSessionEvent[] {
    if (!fs.existsSync(sessionFile)) return [];
    const manager = SessionManager.open(sessionFile, this.sessionsRoot, this.contentStorageRoot);
    return manager
      .getEntries()
      .filter(isReflectaEventEntry)
      .flatMap((entry) => (entry.data ? [entry.data] : []));
  }
}
