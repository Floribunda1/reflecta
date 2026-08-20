import { describe, expect, test, vi } from "vitest";
import type { AgentSessionFeedFrame, AgentSessionProjection } from "@shared/agent";
import { AgentSessionReplica } from "./agent-session-replica";

const projection: AgentSessionProjection = {
  sessionId: "session_1",
  messages: [],
  activeRunId: null,
  status: "idle",
  error: null,
  entityCatalog: [],
  contextCompactions: [],
  activeCompaction: null,
  compactionError: null,
  cancelledAssistantMessageId: null,
};

describe("AgentSessionReplica", () => {
  test("keeps only the latest authoritative frame", () => {
    let receive: ((frame: AgentSessionFeedFrame) => void) | undefined;
    const stop = vi.fn();
    const replica = new AgentSessionReplica((_sessionId, listener) => {
      receive = listener;
      return stop;
    });
    const listener = vi.fn();
    const unsubscribe = replica.subscribe("session_1", listener);

    receive?.({ kind: "state", sessionId: "session_1", revision: 2, session: projection });
    receive?.({
      kind: "state",
      sessionId: "session_1",
      revision: 1,
      session: { ...projection, status: "failed", error: "stale" },
    });

    expect(replica.getSnapshot("session_1")).toMatchObject({
      status: "ready",
      revision: 2,
      session: { status: "idle" },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test("reconnect replaces state with loading and starts a fresh watch", () => {
    const stops = [vi.fn(), vi.fn()];
    const watch = vi.fn((_sessionId, _receive) => stops[watch.mock.calls.length - 1]!);
    const replica = new AgentSessionReplica(watch);
    const unsubscribe = replica.subscribe("session_1", vi.fn());

    replica.reconnect("session_1");

    expect(replica.getSnapshot("session_1")).toEqual({
      status: "loading",
      sessionId: "session_1",
    });
    expect(watch).toHaveBeenCalledTimes(2);
    expect(stops[0]).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test("keeps a submitted session watched until its run settles", () => {
    let receive: ((frame: AgentSessionFeedFrame) => void) | undefined;
    const stop = vi.fn();
    const replica = new AgentSessionReplica((_sessionId, listener) => {
      receive = listener;
      return stop;
    });
    const runningListener = vi.fn();
    replica.subscribeRunning(runningListener);

    replica.retainUntilSettled("session_1");
    receive?.({ kind: "state", sessionId: "session_1", revision: 0, session: projection });
    receive?.({
      kind: "state",
      sessionId: "session_1",
      revision: 1,
      session: { ...projection, status: "running", activeRunId: "run_1" },
    });

    expect(replica.runningSessionId()).toBe("session_1");
    expect(stop).not.toHaveBeenCalled();

    receive?.({
      kind: "state",
      sessionId: "session_1",
      revision: 2,
      session: projection,
    });

    expect(replica.runningSessionId()).toBeNull();
    expect(runningListener).toHaveBeenCalledTimes(3);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test("switching away and back reuses one running projection without duplicating messages", () => {
    let receive: ((frame: AgentSessionFeedFrame) => void) | undefined;
    const stop = vi.fn();
    const watch = vi.fn((_sessionId, listener: (frame: AgentSessionFeedFrame) => void) => {
      receive = listener;
      return stop;
    });
    const replica = new AgentSessionReplica(watch);
    const leave = replica.subscribe("session_1", vi.fn());
    receive?.({
      kind: "state",
      sessionId: "session_1",
      revision: 1,
      session: {
        ...projection,
        status: "running",
        activeRunId: "run_1",
        messages: [
          {
            id: "assistant_1",
            role: "assistant",
            text: "reply",
            createdAt: "2026-08-02T00:00:00.000Z",
          },
        ],
      },
    });
    leave();
    const returnToSession = replica.subscribe("session_1", vi.fn());

    expect(watch).toHaveBeenCalledTimes(1);
    expect(replica.getSnapshot("session_1")).toMatchObject({
      status: "ready",
      session: { messages: [{ id: "assistant_1", text: "reply" }] },
    });

    receive?.({ kind: "state", sessionId: "session_1", revision: 2, session: projection });
    returnToSession();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

/* ---- B3 TDD：全行为 characterization 测试（改 Effect 前先绿，迁后保持绿） ---- */

function makeProjection(overrides: Partial<AgentSessionProjection> = {}): AgentSessionProjection {
  return { ...projection, ...overrides };
}

type Watcher = { receive: (f: AgentSessionFeedFrame) => void; stop: () => void };
function makeReplica() {
  const watchers = new Map<string, Watcher>();
  const watch = vi.fn((sessionId: string, listener: (f: AgentSessionFeedFrame) => void) => {
    const w: Watcher = { receive: listener, stop: vi.fn() };
    watchers.set(sessionId, w);
    return () => w.stop();
  }) as unknown as (sessionId: string, listener: (f: AgentSessionFeedFrame) => void) => () => void;
  const replica = new AgentSessionReplica(watch);
  return { replica, watch, watchers };
}

describe("AgentSessionReplica B3 characterization", () => {
  test("initial snapshot is loading with no watch until subscribed", () => {
    const { replica, watch } = makeReplica();
    expect(replica.getSnapshot("session_1")).toEqual({ status: "loading", sessionId: "session_1" });
    expect(watch).not.toHaveBeenCalled();
  });

  test("subscribe starts a watch and unsubscribe (idle) stops it", () => {
    const { replica, watch, watchers } = makeReplica();
    const unsubscribe = replica.subscribe("session_1", vi.fn());
    expect(watch).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(watchers.get("session_1")!.stop).toHaveBeenCalledTimes(1);
    expect(replica.getSnapshot("session_1")).toEqual({ status: "loading", sessionId: "session_1" });
  });

  test("multiple subscribers share one watch; removing one keeps it, removing last stops", () => {
    const { replica, watch, watchers } = makeReplica();
    const un1 = replica.subscribe("session_1", vi.fn());
    const un2 = replica.subscribe("session_1", vi.fn());
    expect(watch).toHaveBeenCalledTimes(1);
    un1();
    expect(watchers.get("session_1")!.stop).not.toHaveBeenCalled();
    un2();
    expect(watchers.get("session_1")!.stop).toHaveBeenCalledTimes(1);
  });

  test("error frame marks unavailable and stops an idle watch", () => {
    const { replica, watchers } = makeReplica();
    const listener = vi.fn();
    const un = replica.subscribe("session_1", listener);
    watchers.get("session_1")!.receive({
      kind: "error",
      sessionId: "session_1",
      error: { code: "SESSION_NOT_FOUND", message: "gone", retryable: true },
    });
    expect(replica.getSnapshot("session_1")).toEqual({
      status: "unavailable",
      sessionId: "session_1",
      error: { code: "SESSION_NOT_FOUND", message: "gone", retryable: true },
    });
    expect(listener).toHaveBeenCalled();
    // 有活跃订阅者时 error 帧不主动停 watch（listener 仍可重连）
    expect(watchers.get("session_1")!.stop).not.toHaveBeenCalled();
    un();
    expect(watchers.get("session_1")!.stop).toHaveBeenCalledTimes(1);
  });

  test("stale (<= current) revisions are ignored", () => {
    const { replica, watchers } = makeReplica();
    const listener = vi.fn();
    replica.subscribe("session_1", listener);
    watchers.get("session_1")!.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 5,
      session: makeProjection({ status: "running", activeRunId: "r" }),
    });
    const before = listener.mock.calls.length;
    watchers.get("session_1")!.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 5,
      session: makeProjection({ status: "failed", error: "stale" }),
    });
    watchers.get("session_1")!.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 3,
      session: makeProjection({ status: "failed", error: "older" }),
    });
    expect(listener.mock.calls.length).toBe(before);
    expect(replica.getSnapshot("session_1")).toMatchObject({
      revision: 5,
      session: { status: "running" },
    });
  });

  test("a busy session stays watched after the last listener leaves", () => {
    const { replica, watch, watchers } = makeReplica();
    const un = replica.subscribe("session_1", vi.fn());
    watchers.get("session_1")!.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 1,
      session: makeProjection({ status: "running", activeRunId: "r" }),
    });
    un();
    // busy → not stopped, still watched (no new watch created)
    expect(watchers.get("session_1")!.stop).not.toHaveBeenCalled();
    expect(watch).toHaveBeenCalledTimes(1);
  });

  test("retainUntilSettled keeps watch through running and stops once idle", () => {
    const { replica, watchers } = makeReplica();
    replica.retainUntilSettled("session_1");
    const w = watchers.get("session_1")!;
    w.receive({ kind: "state", sessionId: "session_1", revision: 1, session: makeProjection() });
    expect(w.stop).not.toHaveBeenCalled(); // waiting
    w.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 2,
      session: makeProjection({ status: "running", activeRunId: "r" }),
    });
    expect(w.stop).not.toHaveBeenCalled(); // active
    w.receive({ kind: "state", sessionId: "session_1", revision: 3, session: makeProjection() });
    expect(w.stop).toHaveBeenCalledTimes(1); // settled → none → stop
  });

  test("retainUntilSettled manual release stops when idle", () => {
    const { replica, watchers } = makeReplica();
    const release = replica.retainUntilSettled("session_1");
    watchers
      .get("session_1")!
      .receive({ kind: "state", sessionId: "session_1", revision: 1, session: makeProjection() });
    release();
    expect(watchers.get("session_1")!.stop).toHaveBeenCalledTimes(1);
  });

  test("runningSessionId reflects running and activeCompaction", () => {
    const { replica, watchers } = makeReplica();
    replica.retainUntilSettled("session_1");
    watchers.get("session_1")!.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 1,
      session: makeProjection({ status: "running", activeRunId: "r" }),
    });
    expect(replica.runningSessionId()).toBe("session_1");
    watchers.get("session_1")!.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 2,
      session: makeProjection({ activeCompaction: {} as never }),
    });
    expect(replica.runningSessionId()).toBe("session_1");
    watchers
      .get("session_1")!
      .receive({ kind: "state", sessionId: "session_1", revision: 3, session: makeProjection() });
    expect(replica.runningSessionId()).toBeNull();
  });

  test("reconnect with listeners restarts a fresh watch and clears state", () => {
    const { replica, watch, watchers } = makeReplica();
    const un = replica.subscribe("session_1", vi.fn());
    watchers.get("session_1")!.receive({
      kind: "state",
      sessionId: "session_1",
      revision: 2,
      session: makeProjection({ status: "running", activeRunId: "r" }),
    });
    replica.reconnect("session_1");
    expect(replica.getSnapshot("session_1")).toEqual({ status: "loading", sessionId: "session_1" });
    expect(watch).toHaveBeenCalledTimes(2);
    expect(watchers.size).toBe(1); // same map slot replaced
    un();
  });
});
