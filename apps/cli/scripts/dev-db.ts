#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { createDBInstance } from "@reflecta/server";
import { resolveCliRuntimePaths } from "../src/runtime";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const command = process.argv[2];
const runtime = resolveCliRuntimePaths({ buildKind: "source" });
const dbPath = runtime.dbPath;

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

// 开发库迁移的目标数据版本（与 seed-test-data.ts 保持一致；prod 侧由 app.getVersion() 决定）。
const MIGRATE_TARGET_VERSION = "2.0.0";

async function migrate(): Promise<void> {
  ensureDir();
  const db = await createDBInstance(dbPath, {
    appVersion: MIGRATE_TARGET_VERSION,
    runMigrations: true,
  });
  db.$client.close();
}

function run(args: string[]): number {
  const result = spawnSync("bun", args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
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
  fs.rmSync(dbPath, { force: true });
  process.exit(
    run([
      "run",
      path.join(import.meta.dirname, "seed-test-data.ts"),
      dbPath,
      runtime.contentStorageRoot,
      "--data-environment",
      "dev",
    ]),
  );
}

console.log(`Usage: bun run apps/cli/scripts/dev-db.ts <migrate|reset|push|seed>

Dev database:
  ${dbPath}`);
process.exit(command ? 1 : 0);
