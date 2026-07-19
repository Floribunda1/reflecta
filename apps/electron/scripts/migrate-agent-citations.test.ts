import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { applyMigration, scanRoot } from "./migrate-agent-citations";

const roots: string[] = [];

function fixtureRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "reflecta-citation-migration-"));
  roots.push(root);
  const sessions = path.join(root, "Sessions");
  mkdirSync(sessions);
  const entries = [
    { type: "session", id: "session_entry", timestamp: "2026-07-01T00:00:00.000Z" },
    {
      type: "custom",
      customType: "reflecta.agent.event",
      id: "run_entry",
      parentId: "session_entry",
      timestamp: "2026-07-01T00:00:01.000Z",
      data: {
        type: "run.started",
        id: "evt_run",
        sessionId: "session_1",
        runId: "run_1",
        createdAt: "2026-07-01T00:00:01.000Z",
      },
    },
    {
      type: "custom",
      customType: "reflecta.agent.event",
      id: "user_entry",
      parentId: "run_entry",
      timestamp: "2026-07-01T00:00:02.000Z",
      data: {
        type: "user.message",
        id: "evt_user",
        sessionId: "session_1",
        runId: "run_1",
        messageId: "msg_user",
        text: "question",
        createdAt: "2026-07-01T00:00:02.000Z",
      },
    },
    {
      type: "message",
      id: "assistant_entry",
      parentId: "user_entry",
      timestamp: "2026-07-01T00:00:03.000Z",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "见 [1]、[[旧标题#u_1]] 和 [[ref:c_1|上下文]]" }],
      },
    },
    {
      type: "custom",
      customType: "reflecta.agent.event",
      id: "turn_entry",
      parentId: "assistant_entry",
      timestamp: "2026-07-01T00:00:04.000Z",
      data: {
        type: "assistant.turn",
        id: "evt_turn",
        sessionId: "session_1",
        runId: "run_1",
        messageId: "msg_assistant",
        createdAt: "2026-07-01T00:00:04.000Z",
        text: "见 [1]、[[旧标题#u_1]]、[[ref:c_1|上下文]]；`[2]` 与 [2](url) 不动",
        blocks: [
          { kind: "text", text: "见 [1] 和 [[旧标题#u_1]]" },
          { kind: "tool", output: { body: "工具原文 [[旧标题#u_1]]" } },
        ],
        citationSources: [
          { index: 1, entity: { type: "understanding", id: "u_1", title: "旧标题" } },
          { index: 2, entity: { type: "context", id: "c_1", title: "上下文" } },
        ],
      },
    },
  ];
  const file = path.join(sessions, "session.jsonl");
  writeFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  return { root, file };
}

describe("agent citation migration", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  test("converts only assistant citation text and reconstructs the session catalog", () => {
    const { root } = fixtureRoot();
    const plan = scanRoot(root);
    const migrated = plan.files[0]?.updated.split("\n").filter(Boolean).map(JSON.parse) ?? [];
    const turn = migrated.find((entry) => entry.data?.type === "assistant.turn");
    const raw = migrated.find((entry) => entry.id === "assistant_entry");
    const catalog = migrated.find((entry) => entry.data?.type === "entity.catalog.updated");

    expect(plan.errors).toEqual([]);
    expect(turn.data.text).toBe("见 [[u:u_1]]、[[u:u_1]]、[[c:c_1]]；`[2]` 与 [2](url) 不动");
    expect(turn.data).not.toHaveProperty("citationSources");
    expect(turn.data.blocks[0].text).toBe("见 [[u:u_1]] 和 [[u:u_1]]");
    expect(turn.data.blocks[1].output.body).toBe("工具原文 [[旧标题#u_1]]");
    expect(raw.message.content[0].text).toBe("见 [[u:u_1]]、[[u:u_1]] 和 [[c:c_1]]");
    expect(catalog.data.entries).toEqual([
      expect.objectContaining({ key: "understanding:u_1" }),
      expect.objectContaining({ key: "context:c_1" }),
    ]);
  });

  test("backs up changed sessions and becomes a no-op after apply", () => {
    const { root, file } = fixtureRoot();
    const original = readFileSync(file, "utf8");
    const plan = scanRoot(root);
    const backups = applyMigration([plan], "test");

    expect(readFileSync(path.join(backups.get(plan.root)!, "session.jsonl"), "utf8")).toBe(
      original,
    );
    expect(readFileSync(file, "utf8")).not.toBe(original);
    expect(scanRoot(root).totals.sessionsChanged).toBe(0);
  });

  test("merges into an existing legacy catalog event without an envelope id", () => {
    const { root, file } = fixtureRoot();
    const legacyCatalog = {
      type: "custom",
      customType: "reflecta.agent.event",
      data: {
        type: "entity.catalog.updated",
        id: "evt_legacy_catalog",
        sessionId: "session_1",
        createdAt: "2026-07-01T00:00:05.000Z",
        entries: [],
      },
    };
    writeFileSync(file, `${readFileSync(file, "utf8")}${JSON.stringify(legacyCatalog)}\n`);

    const plan = scanRoot(root);
    const migrated = plan.files[0]?.updated.split("\n").filter(Boolean).map(JSON.parse) ?? [];
    const catalogs = migrated.filter((entry) => entry.data?.type === "entity.catalog.updated");

    expect(plan.errors).toEqual([]);
    expect(catalogs).toHaveLength(1);
    expect(catalogs[0].data.entries).toHaveLength(2);
  });
});
