#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import fs from "node:fs";

const dbPath = process.argv[2];
const fixturePath = process.argv[3];

if (!dbPath || !fixturePath) {
  throw new Error("Usage: bun run agent-fixture-db.ts <db-path> <fixture-json-path>");
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as
  | { type: "reset" }
  | {
      type: "seedThread";
      thread: {
        id: string;
        title: string;
        createdAt?: string;
        updatedAt?: string;
        messages?: Array<{
          id: string;
          role: "user" | "assistant";
          parts: unknown[];
          metadata?: unknown;
          createdAt?: string;
        }>;
      };
    }
  | { type: "thoughtIdByTitle"; title: string }
  | { type: "thoughtExistsByTitle"; title: string }
  | { type: "categoryExistsByName"; name: string };

const BASE_TIME = "2026-06-22T08:00:00.000Z";
const db = new Database(dbPath);

try {
  if (fixture.type === "reset") {
    db.exec(`
      DELETE FROM agent_runs;
      DELETE FROM agent_tool_invocations;
      DELETE FROM agent_messages;
      DELETE FROM agent_threads;
    `);
  }

  if (fixture.type === "seedThread") {
    const thread = fixture.thread;
    const createdAt = thread.createdAt ?? BASE_TIME;
    db.prepare(
      `INSERT INTO agent_threads (id, title, status, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?)`,
    ).run(thread.id, thread.title, createdAt, thread.updatedAt ?? createdAt);

    for (const [index, message] of (thread.messages ?? []).entries()) {
      db.prepare(
        `INSERT INTO agent_messages
          (id, thread_id, seq, role, parts_json, attachments_json, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      ).run(
        message.id,
        thread.id,
        index + 1,
        message.role,
        JSON.stringify(message.parts),
        message.metadata ? JSON.stringify(message.metadata) : null,
        message.createdAt ?? BASE_TIME,
      );
    }
  }

  if (fixture.type === "thoughtIdByTitle") {
    const row = db
      .query(`SELECT id FROM thoughts WHERE title = ? AND deleted_at IS NULL LIMIT 1`)
      .get(fixture.title) as { id: string } | null;
    if (!row) throw new Error(`Seed thought not found: ${fixture.title}`);
    console.log(row.id);
  }

  if (fixture.type === "thoughtExistsByTitle") {
    const row = db
      .query(`SELECT 1 AS exists_flag FROM thoughts WHERE title = ? AND deleted_at IS NULL LIMIT 1`)
      .get(fixture.title) as { exists_flag: number } | null;
    console.log(row ? "true" : "false");
  }

  if (fixture.type === "categoryExistsByName") {
    const row = db
      .query(`SELECT 1 AS exists_flag FROM categories WHERE name = ? LIMIT 1`)
      .get(fixture.name) as { exists_flag: number } | null;
    console.log(row ? "true" : "false");
  }
} finally {
  db.close();
}
