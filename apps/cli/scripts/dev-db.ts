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
  dropExplicitIndexes();
  const status = run(["x", "drizzle-kit", "push", "--config", "drizzle.config.ts"]);
  process.exit(status);
}

if (command === "seed") {
  process.exit(run(["run", path.join(import.meta.dirname, "seed-test-data.ts"), dbPath]));
}

console.log(`Usage: bun run apps/cli/scripts/dev-db.ts <migrate|reset|push|seed>

Dev database:
  ${dbPath}`);
process.exit(command ? 1 : 0);
