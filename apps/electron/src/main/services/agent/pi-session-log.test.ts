import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SessionManager } from "@earendil-works/pi-coding-agent";
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
    vi.useRealTimers();
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

  test("mirrors approved tool execution failures to diagnostic logs", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession();
    const manager = await log.openSession(session.id);
    const event: AgentSessionEvent = {
      ...baseEvent,
      id: "evt_tool_failed",
      sessionId: session.id,
      type: "tool.execution.failed",
      messageId: "assistant_1",
      toolCallId: "tool_1",
      toolName: "understanding_update",
      error: { message: "Domain not found: domain_1" },
    };

    log.appendEvent(manager, event);

    expect(logger.writeDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "agent.tool.execution.failed",
        level: "error",
        scope: "agent",
        context: expect.objectContaining({
          sessionId: session.id,
          runId: "run_1",
          messageId: "assistant_1",
          toolCallId: "tool_1",
        }),
        attrs: expect.objectContaining({
          toolName: "understanding_update",
          error: { message: "Domain not found: domain_1" },
        }),
      }),
    );
  });

  test("does not list a pending session until the user sends a message", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession();

    await expect(log.listSessions()).resolves.toEqual([]);

    const manager = await log.openSession(session.id);
    log.appendEvent(manager, {
      ...baseEvent,
      id: "evt_1",
      sessionId: session.id,
      type: "run.started",
    });

    await expect(log.listSessions()).resolves.toEqual([]);

    log.appendEvent(manager, {
      ...baseEvent,
      id: "evt_2",
      sessionId: session.id,
      type: "user.message",
      messageId: "user_1",
      text: "hello",
    });

    await expect(log.listSessions()).resolves.toEqual([
      expect.objectContaining({ id: session.id, title: "hello" }),
    ]);
  });

  test("backfills once, then restores the list and selected conversation without rescanning", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession();
    const manager = await log.openSession(session.id);
    const userMessage: AgentSessionEvent = {
      ...baseEvent,
      id: "evt_user",
      sessionId: session.id,
      type: "user.message",
      messageId: "user_1",
      text: "冷启动也应该立即出现",
    };
    log.appendEvent(manager, userMessage);
    const hiddenSession = log.createSession();
    const hiddenManager = await log.openSession(hiddenSession.id);
    log.appendEvent(hiddenManager, {
      ...baseEvent,
      id: "evt_hidden_run",
      sessionId: hiddenSession.id,
      type: "run.started",
    });

    fs.rmSync(path.join(getPiAgentSessionsRoot(root), "sessions-index.json"));
    await expect(new AgentSessionLog(root).listSessions()).resolves.toEqual([
      expect.objectContaining({ id: session.id, title: "冷启动也应该立即出现" }),
    ]);

    const listSpy = vi
      .spyOn(SessionManager, "list")
      .mockRejectedValue(new Error("full session scan should not run"));
    try {
      const restored = new AgentSessionLog(root);
      await expect(restored.listSessions()).resolves.toEqual([
        expect.objectContaining({ id: session.id, title: "冷启动也应该立即出现" }),
      ]);
      await expect(restored.readEvents(session.id)).resolves.toEqual([userMessage]);
      expect(listSpy).not.toHaveBeenCalled();
    } finally {
      listSpy.mockRestore();
    }
  });

  test("keeps the indexed title and deletion in sync with the session file", async () => {
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession();
    const manager = await log.openSession(session.id);
    log.appendEvent(manager, {
      ...baseEvent,
      id: "evt_user",
      sessionId: session.id,
      type: "user.message",
      messageId: "user_1",
      text: "原始标题",
    });

    await log.renameSession(session.id, "整理后的标题");
    await expect(new AgentSessionLog(root).listSessions()).resolves.toEqual([
      expect.objectContaining({ id: session.id, title: "整理后的标题" }),
    ]);

    await log.deleteSession(session.id);
    await expect(new AgentSessionLog(root).listSessions()).resolves.toEqual([]);
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
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "old reply",
        blocks: [{ kind: "text", text: "old reply", createdAt: baseEvent.createdAt }],
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
        type: "assistant.turn",
        messageId: "assistant_2",
        text: "old second reply",
        blocks: [{ kind: "text", text: "old second reply", createdAt: baseEvent.createdAt }],
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

  test("restores catalog events from the active branch only after editing a message", async () => {
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
        type: "user.message",
        messageId: "user_1",
        text: "first",
      },
      { ...baseEvent, id: "evt_3", sessionId: session.id, type: "run.completed" },
      {
        ...baseEvent,
        id: "evt_4",
        sessionId: session.id,
        runId: "run_2",
        type: "run.started",
      },
      {
        ...baseEvent,
        id: "evt_5",
        sessionId: session.id,
        runId: "run_2",
        type: "entity.catalog.updated",
        entries: [
          {
            key: "context:discarded_context",
            entity: { type: "context", id: "discarded_context", title: "Discarded" },
            origin: { kind: "user_context", messageId: "user_2" },
          },
        ],
      },
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
        type: "run.completed",
      },
    ];
    for (const event of events) log.appendEvent(manager, event);

    const branched = await log.openSessionForEditedMessage(session.id, "user_2");
    log.appendEvent(branched, {
      ...baseEvent,
      id: "evt_8",
      sessionId: session.id,
      runId: "run_3",
      type: "run.started",
    });

    await expect(log.readEvents(session.id)).resolves.toEqual([
      events[0],
      events[1],
      events[2],
      expect.objectContaining({ id: "evt_8", type: "run.started" }),
    ]);
  });

  test("drops compaction receipts from an abandoned branch after editing a message", async () => {
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
        type: "user.message",
        messageId: "user_1",
        text: "first",
      },
      { ...baseEvent, id: "evt_3", sessionId: session.id, type: "run.completed" },
      {
        ...baseEvent,
        id: "evt_4",
        sessionId: session.id,
        runId: "run_2",
        type: "run.started",
      },
      {
        ...baseEvent,
        id: "evt_5",
        sessionId: session.id,
        runId: "run_2",
        type: "user.message",
        messageId: "user_2",
        text: "old second",
      },
      { ...baseEvent, id: "evt_6", sessionId: session.id, runId: "run_2", type: "run.completed" },
      {
        ...baseEvent,
        id: "evt_7",
        sessionId: session.id,
        type: "context.compacted",
        reason: "threshold",
        summary: "discarded checkpoint",
        firstKeptEntryId: "entry_1",
        tokensBefore: 120_000,
        estimatedTokensAfter: 18_000,
        afterMessageId: "user_2",
      },
    ];
    for (const event of events) log.appendEvent(manager, event);

    const branched = await log.openSessionForEditedMessage(session.id, "user_2");
    log.appendEvent(branched, {
      ...baseEvent,
      id: "evt_8",
      sessionId: session.id,
      runId: "run_3",
      type: "run.started",
    });

    await expect(log.readEvents(session.id)).resolves.toEqual([
      events[0],
      events[1],
      events[2],
      expect.objectContaining({ id: "evt_8", type: "run.started" }),
    ]);
  });

  test("forks from an assistant message without keeping later turns", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-06-23T00:00:00.000Z");
    const root = tempRoot();
    const log = new AgentSessionLog(root);
    const session = log.createSession();
    const manager = await log.openSession(session.id);
    manager.appendSessionInfo("原对话");
    manager.appendMessage({
      role: "user",
      content: [{ type: "text", text: "hello" }],
      timestamp: Date.now(),
    });
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
      {
        ...baseEvent,
        id: "evt_3",
        sessionId: session.id,
        type: "assistant.turn",
        messageId: "assistant_1",
        text: "first reply",
        blocks: [{ kind: "text", text: "first reply", createdAt: baseEvent.createdAt }],
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
        text: "later",
      },
      {
        ...baseEvent,
        id: "evt_7",
        sessionId: session.id,
        runId: "run_2",
        type: "run.completed",
      },
      {
        ...baseEvent,
        id: "evt_8",
        sessionId: session.id,
        type: "context.compacted",
        reason: "threshold",
        summary: "later checkpoint",
        firstKeptEntryId: "entry_1",
        tokensBefore: 120_000,
        afterMessageId: "user_2",
      },
    ];
    for (const event of events) log.appendEvent(manager, event);

    vi.setSystemTime("2026-06-24T00:00:00.000Z");
    const fork = await log.forkSessionFromAssistantMessage(session.id, "assistant_1");

    expect(fork.id).not.toBe(session.id);
    expect(fork.title).toBe("Fork - 原对话");
    await expect(log.readEvents(fork.id)).resolves.toEqual(
      events.slice(0, 4).map((event) => ({ ...event, sessionId: fork.id })),
    );
    const persistedFork = (await log.listSessions()).find((item) => item.id === fork.id);
    expect(persistedFork?.updatedAt).toBe(fork.updatedAt);
  });
});
