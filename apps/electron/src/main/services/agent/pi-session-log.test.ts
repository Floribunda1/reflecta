import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { AgentSessionEvent } from "@shared/agent";
import { AgentSessionLog, getPiAgentSessionsRoot } from "./pi-session-log";

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

describe("AgentSessionLog", () => {
  afterEach(() => {
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

    expect(
      fs.readdirSync(getPiAgentSessionsRoot(root)).some((name) => name.endsWith(".jsonl")),
    ).toBe(true);
    await expect(new AgentSessionLog(root).readEvents(session.id)).resolves.toEqual(events);
  });
});
