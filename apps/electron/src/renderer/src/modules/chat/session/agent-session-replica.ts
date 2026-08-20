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

type Watch = (sessionId: string, receive: (frame: AgentSessionFeedFrame) => void) => () => void;

/* ------------------------------------------------------------------ *
 * 纯核心（FP）：状态是不可变值，转移是纯函数，副作用只在类边界执行。
 * ------------------------------------------------------------------ */

/** 一个会话的可串行化视图（不含监听器 / 停止函数等桥接引用）。 */
type SessionView = {
  read: AgentSessionRead;
  /** 提交后保留：waiting（等它进入/离开 busy）→ active（busy 中）→ none（settled 释放）。 */
  retention: "none" | "waiting" | "active";
};

const initialView = (sessionId: string): SessionView => ({
  read: { status: "loading", sessionId },
  retention: "none",
});

const isBusy = (session: AgentSessionProjection): boolean =>
  session.status === "running" || Boolean(session.activeCompaction);

/** 纯判定：给定视图与活跃监听数，是否应继续 watch。 */
const shouldKeepWatching = (view: SessionView, activeListeners: number): boolean => {
  if (activeListeners > 0) return true;
  if (view.retention !== "none") return true;
  if (view.read.status === "ready" && isBusy(view.read.session)) return true;
  return false;
};

/**
 * 纯 reducer：把一帧应用到视图，返回下一视图 + 是否该停止 watch。
 * - revision 门控（丢弃 ≤ 当前的过时帧）在纯函数里完成，不入副作用回调。
 * - error 帧 → unavailable；保留态按 busy 在 waiting/active/none 间转移。
 */
const step = (
  frame: AgentSessionFeedFrame,
  view: SessionView,
  activeListeners: number,
): { view: SessionView; stop: boolean } => {
  if (frame.kind === "error") {
    const next: SessionView = {
      read: { status: "unavailable", sessionId: frame.sessionId, error: frame.error },
      retention: "none",
    };
    return { view: next, stop: !shouldKeepWatching(next, activeListeners) };
  }
  if (view.read.status === "ready" && frame.revision <= view.read.revision) {
    return { view, stop: false }; // 过时帧：不变、不通知、不停
  }
  const busy = isBusy(frame.session);
  let retention = view.retention;
  if (busy && retention === "waiting") retention = "active";
  else if (!busy && retention === "active") retention = "none";
  const next: SessionView = {
    read: {
      status: "ready",
      sessionId: frame.sessionId,
      revision: frame.revision,
      session: frame.session,
    },
    retention,
  };
  return { view: next, stop: !shouldKeepWatching(next, activeListeners) };
};

/* ------------------------------------------------------------------ *
 * 类只是边界壳：持有不可变视图 + 桥接引用（监听器 / 停止函数），
 * 逻辑委托给上面的纯函数。
 * ------------------------------------------------------------------ */

export class AgentSessionReplica {
  private readonly views = new Map<string, SessionView>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly stops = new Map<string, () => void>();
  private readonly runningListeners = new Set<() => void>();

  constructor(private readonly watch: Watch) {}

  /** 稳定获取/注册一个会话的视图（useSyncExternalStore 需要快照引用稳定）。 */
  private viewFor(sessionId: string): SessionView {
    let view = this.views.get(sessionId);
    if (!view) {
      view = initialView(sessionId);
      this.views.set(sessionId, view);
    }
    return view;
  }

  getSnapshot(sessionId: string): AgentSessionRead {
    return this.viewFor(sessionId).read;
  }

  subscribe(sessionId: string, listener: () => void): () => void {
    let set = this.listeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.listeners.set(sessionId, set);
    }
    set.add(listener);
    this.ensureWatching(sessionId);
    return () => {
      const current = this.listeners.get(sessionId);
      current?.delete(listener);
      this.stopIfUnused(sessionId);
    };
  }

  runningSessionId(): string | null {
    for (const [sessionId, view] of this.views) {
      if (view.read.status === "ready" && isBusy(view.read.session)) return sessionId;
    }
    return null;
  }

  subscribeRunning(listener: () => void): () => void {
    this.runningListeners.add(listener);
    return () => this.runningListeners.delete(listener);
  }

  retainUntilSettled(sessionId: string): () => void {
    this.views.set(sessionId, { ...this.viewFor(sessionId), retention: "waiting" });
    this.ensureWatching(sessionId);
    return () => {
      const view = this.views.get(sessionId);
      if (!view || view.retention !== "waiting") return;
      this.views.set(sessionId, { ...view, retention: "none" });
      this.stopIfUnused(sessionId);
    };
  }

  reconnect(sessionId: string): void {
    this.stopWatching(sessionId);
    this.views.set(sessionId, initialView(sessionId));
    this.notify(sessionId);
    this.ensureWatching(sessionId);
  }

  /* ---- 边界副作用 ---- */

  private ensureWatching(sessionId: string): void {
    if (this.stops.has(sessionId)) return;
    const active = this.listeners.get(sessionId)?.size ?? 0;
    const view = this.viewFor(sessionId);
    if (active === 0 && view.retention === "none") return;
    const stop = this.watch(sessionId, (frame) => this.onFrame(sessionId, frame));
    this.stops.set(sessionId, stop);
  }

  private stopWatching(sessionId: string): void {
    const stop = this.stops.get(sessionId);
    if (stop) stop();
    this.stops.delete(sessionId);
  }

  private stopIfUnused(sessionId: string): void {
    const view = this.viewFor(sessionId);
    const active = this.listeners.get(sessionId)?.size ?? 0;
    if (shouldKeepWatching(view, active)) return;
    this.stopWatching(sessionId);
  }

  private onFrame(sessionId: string, frame: AgentSessionFeedFrame): void {
    const view = this.viewFor(sessionId);
    const active = this.listeners.get(sessionId)?.size ?? 0;
    const { view: next, stop } = step(frame, view, active);
    if (next === view) return; // 过时帧：不变不通知
    this.views.set(sessionId, next);
    this.notify(sessionId);
    if (stop) this.stopWatching(sessionId);
  }

  private notify(sessionId: string): void {
    for (const listener of this.listeners.get(sessionId) ?? []) listener();
    for (const listener of this.runningListeners) listener();
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
