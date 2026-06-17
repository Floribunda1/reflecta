#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { createDBInstance } from "@reflecta/server";
import { resolveProfileDbPath } from "../src/profile";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const command = process.argv[2];
const dbPath = resolveProfileDbPath("dev");

function ensureDir(): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function withDb(fn: (db: Database) => void): void {
  ensureDir();
  const db = new Database(dbPath);
  try {
    fn(db);
  } finally {
    db.close();
  }
}

function dropFtsTables(): void {
  if (!fs.existsSync(dbPath)) return;
  withDb((db) => {
    db.exec(`
      DROP TABLE IF EXISTS fts_thoughts;
      DROP TABLE IF EXISTS fts_contexts;
    `);
  });
}

function dropExplicitIndexes(): void {
  if (!fs.existsSync(dbPath)) return;
  withDb((db) => {
    const indexes = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL",
      )
      .all();
    for (const index of indexes) {
      db.exec(`DROP INDEX IF EXISTS "${index.name.replaceAll('"', '""')}"`);
    }
  });
}

async function migrate(): Promise<void> {
  ensureDir();
  const db = await createDBInstance(dbPath, { runMigrations: true });
  db.$client.close();
}

function rebuildFtsTables(): void {
  withDb((db) => {
    db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_thoughts USING fts5(
      thought_id UNINDEXED,
      title,
      body
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS fts_contexts USING fts5(
      context_id UNINDEXED,
      thought_id UNINDEXED,
      source_name,
      content
    );

    DELETE FROM fts_thoughts;
    DELETE FROM fts_contexts;

    INSERT INTO fts_thoughts (thought_id, title, body)
    SELECT id, coalesce(title, ''), body
    FROM thoughts
    WHERE deleted_at IS NULL;

    INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
    SELECT id, thought_id, source_name, content
    FROM contexts
    WHERE deleted_at IS NULL;
  `);
  });
}

function run(args: string[]): number {
  const result = spawnSync("bun", args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      REFLECTA_PROFILE: "dev",
      REFLECTA_DB_PATH: dbPath,
    },
  });

  return result.status ?? 1;
}

if (command === "reset") {
  fs.rmSync(dbPath, { force: true });
  ensureDir();
  console.log(`Deleted dev database: ${dbPath}`);
  process.exit(0);
}

if (command === "migrate") {
  await migrate();
  process.exit(0);
}

if (command === "push") {
  ensureDir();
  await migrate();
  dropFtsTables();
  dropExplicitIndexes();
  const status = run(["x", "drizzle-kit", "push", "--config", "drizzle.config.ts"]);
  if (fs.existsSync(dbPath)) rebuildFtsTables();
  process.exit(status);
}

if (command === "seed") {
  if (fs.existsSync(dbPath)) rebuildFtsTables();
  process.exit(run(["run", path.join(import.meta.dirname, "seed-test-data.ts"), dbPath]));
}

console.log(`Usage: bun run apps/cli/scripts/dev-db.ts <migrate|reset|push|seed>

Dev database:
  ${dbPath}`);
process.exit(command ? 1 : 0);
