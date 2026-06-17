#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { resolveProfileDbPath } from "../src/profile";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const command = process.argv[2];
const dbPath = resolveProfileDbPath("dev");

function ensureDir(): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function ensureFtsTables(): void {
  ensureDir();
  const db = new Database(dbPath);
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
  `);
  db.close();
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

if (command === "push") {
  ensureDir();
  const status = run(["x", "drizzle-kit", "push", "--config", "drizzle.config.ts"]);
  if (status === 0) ensureFtsTables();
  process.exit(status);
}

if (command === "seed") {
  if (fs.existsSync(dbPath)) ensureFtsTables();
  process.exit(run(["run", path.join(import.meta.dirname, "seed-test-data.ts"), dbPath]));
}

console.log(`Usage: bun run apps/cli/scripts/dev-db.ts <reset|push|seed>

Dev database:
  ${dbPath}`);
process.exit(command ? 1 : 0);
