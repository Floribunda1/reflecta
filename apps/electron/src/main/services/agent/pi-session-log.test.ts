import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentSessionEvent } from "@shared/agent";
import { AgentSessionLog, getPiAgentSessionsRoot } from "./pi-session-log";

const logger = vi.hoisted(() => ({
  writeDiagnosticEvent: vi.fn(),
}));

vi.mock("../../logger", () => logger);

const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-pi-session-log-"));
  roots.push(root);
  return root;
}

const baseEvent = {
  sessionId: "session_1",
  runId: "run_1",
  createdAt: "2026-06-23T00:00:00.000Z",
};

function customEntryByEventId(manager: { getEntries(): unknown[] }, eventId: string) {
  return manager.getEntries().find((entry) => {
    if (!entry || typeof entry !== "object" || !("type" in entry) || entry.type !== "custom") {
      return false;
    }
    const data = "data" in entry ? entry.data : undefined;
    return Boolean(data && typeof data === "object" && "id" in data && data.id === eventId);
  }) as { id: string; parentId: string | null } | undefined;
}

describe("AgentSessionLog", () => {
  afterEach(() => {
    vi.clearAllMocks();
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  test("persists custom-only run events before Pi writes an assistant message", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession();
    const manager = await log.openSession(session.id);
    const events: AgentSessionEvent[] = [
      { ...baseEvent, id: "evt_1", sessionId: session.id, type: "run.started" },
      {
        ...baseEvent,
        id: "evt_2",
        sessionId: session.id,
        type: "run.failed",
        error: "invalid api key",
      },
    ];

    for (const event of events) log.appendEvent(manager, event);

    expect(logger.writeDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "agent.run.failed",
        level: "error",
        scope: "agent",
        context: expect.objectContaining({ sessionId: session.id, runId: "run_1" }),
        attrs: expect.objectContaining({ error: "invalid api key" }),
      }),
    );
    expect(
      fs.readdirSync(getPiAgentSessionsRoot(root)).some((name) => name.endsWith(".jsonl")),
    ).toBe(true);
    await expect(new AgentSessionLog(root).readEvents(session.id)).resolves.toEqual(events);
  });

  test("branches before the edited user message run without keeping later output", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession();
    const manager = await log.openSession(session.id);
    const originalRuns: AgentSessionEvent[] = [
      { ...baseEvent, id: "evt_1", sessionId: session.id, type: "run.started" },
      {
        ...baseEvent,
        id: "evt_2",
        sessionId: session.id,
        type: "user.message",
        messageId: "user_1",
        text: "old",
      },
      {
        ...baseEvent,
        id: "evt_3",
        sessionId: session.id,
        type: "assistant.text.delta",
        messageId: "assistant_1",
        delta: "old reply",
      },
      { ...baseEvent, id: "evt_4", sessionId: session.id, type: "run.completed" },
      { ...baseEvent, id: "evt_5", sessionId: session.id, runId: "run_2", type: "run.started" },
      {
        ...baseEvent,
        id: "evt_6",
        sessionId: session.id,
        runId: "run_2",
        type: "user.message",
        messageId: "user_2",
        text: "old second",
      },
      {
        ...baseEvent,
        id: "evt_7",
        sessionId: session.id,
        runId: "run_2",
        type: "assistant.text.delta",
        messageId: "assistant_2",
        delta: "old second reply",
      },
      { ...baseEvent, id: "evt_8", sessionId: session.id, runId: "run_2", type: "run.completed" },
    ];
    for (const event of originalRuns) log.appendEvent(manager, event);
    const firstRunCompletedEntry = customEntryByEventId(manager, "evt_4");
    expect(firstRunCompletedEntry).toBeDefined();

    const branched = await log.openSessionForEditedMessage(session.id, "user_2");
    const editedRun: AgentSessionEvent = {
      ...baseEvent,
      id: "evt_9",
      sessionId: session.id,
      runId: "run_3",
      type: "run.started",
    };
    log.appendEvent(branched, editedRun);

    expect(customEntryByEventId(branched, "evt_9")?.parentId).toBe(firstRunCompletedEntry?.id);
  });

  test("forks the current branch into a new session id", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession("原对话");
    const manager = await log.openSession(session.id);
    const events: AgentSessionEvent[] = [
      { ...baseEvent, id: "evt_1", sessionId: session.id, type: "run.started" },
      {
        ...baseEvent,
        id: "evt_2",
        sessionId: session.id,
        type: "user.message",
        messageId: "user_1",
        text: "hello",
      },
    ];
    for (const event of events) log.appendEvent(manager, event);

    const fork = await log.forkSession(session.id);

    expect(fork.id).not.toBe(session.id);
    await expect(log.readEvents(fork.id)).resolves.toEqual(
      events.map((event) => ({ ...event, sessionId: fork.id })),
    );
  });
});
