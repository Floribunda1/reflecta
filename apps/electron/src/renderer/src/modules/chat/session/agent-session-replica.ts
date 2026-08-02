import { useCallback, useSyncExternalStore } from "react";
import type {
  AgentSessionFeedError,
  AgentSessionFeedFrame,
  AgentSessionProjection,
} from "@shared/agent";

export type AgentSessionRead =
  | { status: "loading"; sessionId: string }
  | {
      status: "ready";
      sessionId: string;
      revision: number;
      session: AgentSessionProjection;
    }
  | { status: "unavailable"; sessionId: string; error: AgentSessionFeedError };

type Entry = {
  read: AgentSessionRead;
  listeners: Set<() => void>;
  stop: (() => void) | null;
  retention: "none" | "waiting" | "active";
};

type Watch = (sessionId: string, receive: (frame: AgentSessionFeedFrame) => void) => () => void;

export class AgentSessionReplica {
  private readonly entries = new Map<string, Entry>();
  private readonly runningListeners = new Set<() => void>();

  constructor(private readonly watch: Watch) {}

  getSnapshot(sessionId: string): AgentSessionRead {
    return this.entry(sessionId).read;
  }

  subscribe(sessionId: string, listener: () => void): () => void {
    const entry = this.entry(sessionId);
    entry.listeners.add(listener);
    this.start(sessionId, entry);
    return () => {
      entry.listeners.delete(listener);
      this.stopIfUnused(entry);
    };
  }

  runningSessionId(): string | null {
    for (const [sessionId, entry] of this.entries) {
      if (entry.read.status === "ready" && this.isBusy(entry.read.session)) return sessionId;
    }
    return null;
  }

  subscribeRunning(listener: () => void): () => void {
    this.runningListeners.add(listener);
    return () => this.runningListeners.delete(listener);
  }

  retainUntilSettled(sessionId: string): () => void {
    const entry = this.entry(sessionId);
    entry.retention = "waiting";
    this.start(sessionId, entry);
    return () => {
      if (entry.retention !== "waiting") return;
      entry.retention = "none";
      this.stopIfUnused(entry);
    };
  }

  reconnect(sessionId: string): void {
    const entry = this.entry(sessionId);
    entry.stop?.();
    entry.stop = null;
    entry.read = { status: "loading", sessionId };
    this.notify(entry);
    if (entry.listeners.size > 0 || entry.retention !== "none") this.start(sessionId, entry);
  }

  private entry(sessionId: string): Entry {
    const existing = this.entries.get(sessionId);
    if (existing) return existing;
    const entry: Entry = {
      read: { status: "loading", sessionId },
      listeners: new Set(),
      stop: null,
      retention: "none",
    };
    this.entries.set(sessionId, entry);
    return entry;
  }

  private start(sessionId: string, entry: Entry): void {
    if (entry.stop) return;
    entry.stop = this.watch(sessionId, (frame) => {
      if (frame.sessionId !== sessionId) return;
      if (frame.kind === "error") {
        entry.retention = "none";
        entry.read = { status: "unavailable", sessionId, error: frame.error };
        this.notify(entry);
        this.stopIfUnused(entry);
        return;
      }
      if (entry.read.status === "ready" && frame.revision <= entry.read.revision) {
        return;
      }
      entry.read = {
        status: "ready",
        sessionId,
        revision: frame.revision,
        session: frame.session,
      };
      const busy = this.isBusy(frame.session);
      if (busy && entry.retention === "waiting") entry.retention = "active";
      else if (!busy && entry.retention === "active") entry.retention = "none";
      this.notify(entry);
      this.stopIfUnused(entry);
    });
  }

  private notify(entry: Entry): void {
    for (const listener of entry.listeners) listener();
    for (const listener of this.runningListeners) listener();
  }

  private isBusy(session: AgentSessionProjection): boolean {
    return session.status === "running" || Boolean(session.activeCompaction);
  }

  private stopIfUnused(entry: Entry): void {
    if (entry.listeners.size > 0 || entry.retention !== "none") return;
    if (entry.read.status === "ready" && this.isBusy(entry.read.session)) return;
    entry.stop?.();
    entry.stop = null;
  }
}

export const agentSessionReplica = new AgentSessionReplica((sessionId, receive) =>
  window.agentSessionFeed.watch(sessionId, receive),
);

export function useAgentSession(sessionId: string): AgentSessionRead {
  const subscribe = useCallback(
    (listener: () => void) => agentSessionReplica.subscribe(sessionId, listener),
    [sessionId],
  );
  const getSnapshot = useCallback(() => agentSessionReplica.getSnapshot(sessionId), [sessionId]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRunningAgentSessionId(): string | null {
  const subscribe = useCallback(
    (listener: () => void) => agentSessionReplica.subscribeRunning(listener),
    [],
  );
  const getSnapshot = useCallback(() => agentSessionReplica.runningSessionId(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
