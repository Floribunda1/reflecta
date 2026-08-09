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
