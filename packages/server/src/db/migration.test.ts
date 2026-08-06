import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createDBInstance, type ReflectaDb } from ".";
import {
  compareVersions,
  parseAppVersion,
  parseMigrationVersion,
  performDbMigration,
  readDataVersion,
  type MigrationContext,
} from "./migration";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs = [];
});

async function createTestDb(appVersion: string) {
  const tempDir = await mkdtemp(join(tmpdir(), "reflecta-migration-"));
  tempDirs.push(tempDir);
  return createDBInstance(join(tempDir, "test.db"), { appVersion, runMigrations: true });
}

function hasTable(db: ReflectaDb, tableName: string) {
  const row = db.$client
    .prepare<[string]>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(tableName) as { name: string } | null;
  return Boolean(row);
}

function tableColumns(db: ReflectaDb, tableName: string): string[] {
  const rows = db.$client.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
  return rows.map((row) => row.name);
}

describe("versioned migrations", () => {
  test("sorts migration versions numerically", () => {
    const names = ["v1.10.0.sql", "v1.0.0.sql", "v1.2.0.sql"];

    expect(
      names.sort((a, b) => compareVersions(parseMigrationVersion(a), parseMigrationVersion(b))),
    ).toEqual(["v1.0.0.sql", "v1.2.0.sql", "v1.10.0.sql"]);
  });

  test("parses app versions without a leading v", () => {
    expect(parseAppVersion("1.2.3")).toEqual([1, 2, 3]);
  });

  test("keeps the old Agent tables in the v1.0.0 schema", async () => {
    const db = await createTestDb("1.0.0");

    expect(hasTable(db, "agent_threads")).toBe(true);
    expect(hasTable(db, "agent_messages")).toBe(true);
    expect(hasTable(db, "agent_tool_invocations")).toBe(true);
    expect(hasTable(db, "agent_runs")).toBe(true);
  });

  test("drops the old Agent conversation tables in v1.1.0", async () => {
    const db = await createTestDb("1.1.0");

    expect(hasTable(db, "agent_threads")).toBe(false);
    expect(hasTable(db, "agent_messages")).toBe(false);
    expect(hasTable(db, "agent_tool_invocations")).toBe(false);
    expect(hasTable(db, "agent_runs")).toBe(false);
  });

  test("deletes SQLite FTS tables in v1.1.0", async () => {
    const db = await createTestDb("1.1.0");

    expect(hasTable(db, "fts_thoughts")).toBe(false);
    expect(hasTable(db, "fts_understandings")).toBe(false);
    expect(hasTable(db, "fts_contexts")).toBe(false);
  });

  test("migrates knowledge tables to the unified product language in v1.1.0", async () => {
    const db = await createTestDb("1.0.0");

    db.$client
      .prepare(`INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run("domain-1", "AI / Agent", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    db.$client
      .prepare(
        `INSERT INTO thoughts (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        "understanding-1",
        "反馈系统",
        "规划不是预测未来，而是建立反馈系统。",
        "2026-01-02T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      );
    db.$client
      .prepare(`INSERT INTO thought_categories (thought_id, category_id) VALUES (?, ?)`)
      .run("understanding-1", "domain-1");
    db.$client
      .prepare(
        `INSERT INTO contexts (id, thought_id, source_type, source_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "context-1",
        "understanding-1",
        "ai",
        "一次 Agent 架构对话",
        "这段上下文后来支撑了这条理解。",
        "2026-01-03T00:00:00.000Z",
      );

    await performDbMigration(db, "1.1.0");

    expect(hasTable(db, "understandings")).toBe(true);
    expect(hasTable(db, "domains")).toBe(true);
    expect(hasTable(db, "understanding_domains")).toBe(true);
    expect(hasTable(db, "understanding_connections")).toBe(true);
    expect(hasTable(db, "thoughts")).toBe(false);
    expect(hasTable(db, "categories")).toBe(false);

    expect(tableColumns(db, "contexts")).toEqual(
      expect.arrayContaining(["understanding_id", "medium", "title", "content"]),
    );
    expect(tableColumns(db, "contexts")).not.toEqual(
      expect.arrayContaining(["thought_id", "source_type", "source_name"]),
    );

    expect(
      db.$client
        .prepare(`SELECT title, body FROM understandings WHERE id = ?`)
        .get("understanding-1"),
    ).toMatchObject({
      title: "反馈系统",
      body: "规划不是预测未来，而是建立反馈系统。",
    });

    expect(
      db.$client
        .prepare(`SELECT understanding_id, medium, title, content FROM contexts WHERE id = ?`)
        .get("context-1"),
    ).toMatchObject({
      understanding_id: "understanding-1",
      medium: "ai",
      title: "一次 Agent 架构对话",
      content: "这段上下文后来支撑了这条理解。",
    });
  });

  test("migrates legacy Understanding links without rewriting Context content in v1.3.5", async () => {
    const db = await createTestDb("1.1.0");
    const createdAt = "2026-07-31T00:00:00.000Z";

    db.$client
      .prepare(
        `INSERT INTO understandings (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        "understanding-source",
        "来源",
        "参见 [[旧标题#understanding-target]]，再次参见 [[另一标题#understanding-other]]。",
        createdAt,
        createdAt,
      );
    db.$client
      .prepare(
        `INSERT INTO contexts (id, understanding_id, medium, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "context-1",
        "understanding-source",
        "ai",
        "一次讨论",
        "关联 [[旧标题#understanding-target]]，保留 [[u:already-canonical]]。",
        createdAt,
      );

    await performDbMigration(db, "1.3.5");

    expect(
      db.$client
        .prepare(`SELECT body FROM understandings WHERE id = ?`)
        .get("understanding-source"),
    ).toMatchObject({
      body: "参见 [[u:understanding-target]]，再次参见 [[u:understanding-other]]。",
    });
    expect(
      db.$client.prepare(`SELECT content FROM contexts WHERE id = ?`).get("context-1"),
    ).toMatchObject({
      content: "关联 [[旧标题#understanding-target]]，保留 [[u:already-canonical]]。",
    });
  });
});

describe("code migrations (A7)", () => {
  test("executes a registered code migration with db + sql context", async () => {
    const db = await createTestDb("1.0.0");
    const result = await performDbMigration(db, "1.1.0", {
      codeMigrations: [
        {
          name: "v1.1.0-code.sql",
          version: [1, 1, 0] as const,
          up: (ctx: MigrationContext) => {
            ctx.sql("CREATE TABLE IF NOT EXISTS code_migrated (id TEXT)");
          },
        },
      ],
    });
    expect(hasTable(db, "code_migrated")).toBe(true);
    expect(result.executed).toEqual(["v1.1.0.sql", "v1.1.0-code.sql"]);
  });

  test("supports async up and records index rebuild request", async () => {
    const db = await createTestDb("1.0.0");
    const result = await performDbMigration(db, "1.1.0", {
      codeMigrations: [
        {
          name: "v1.1.0-request-rebuild.ts",
          version: [1, 1, 0] as const,
          up: async (ctx: MigrationContext) => {
            await Promise.resolve();
            ctx.sql("CREATE TABLE IF NOT EXISTS async_migrated (id TEXT)");
            ctx.requestRetrievalIndexRebuild();
          },
        },
      ],
    });
    expect(hasTable(db, "async_migrated")).toBe(true);
    expect(result.executed).toContain("v1.1.0-request-rebuild.ts");
  });

  test("runs a code migration once even when migration is re-invoked", async () => {
    const db = await createTestDb("1.0.0");
    let runs = 0;
    const options = {
      codeMigrations: [
        {
          name: "v1.1.0-count.ts",
          version: [1, 1, 0] as const,
          up: (ctx: MigrationContext) => {
            runs += 1;
            ctx.sql("CREATE TABLE IF NOT EXISTS counted (id TEXT)");
          },
        },
      ],
    };
    await performDbMigration(db, "1.1.0", options);
    await performDbMigration(db, "1.1.0", options);
    expect(runs).toBe(1);
  });

  test("code migration runs alongside SQL migrations up to the target version", async () => {
    const db = await createTestDb("1.0.0");
    await performDbMigration(db, "1.1.0", {
      codeMigrations: [
        {
          name: "v1.1.0-after-sql.ts",
          version: [1, 1, 0] as const,
          up: (ctx: MigrationContext) => {
            ctx.sql("CREATE TABLE IF NOT EXISTS after_sql (id TEXT)");
          },
        },
      ],
    });
    // SQL v1.1.0 建了统一语言表
    expect(hasTable(db, "understandings")).toBe(true);
    expect(hasTable(db, "after_sql")).toBe(true);
  });

  test("skips code migrations newer than target version", async () => {
    const db = await createTestDb("1.0.0");
    await performDbMigration(db, "1.0.0", {
      codeMigrations: [
        {
          name: "v1.1.0-too-new.ts",
          version: [1, 1, 0] as const,
          up: (ctx: MigrationContext) => {
            ctx.sql("CREATE TABLE IF NOT EXISTS should_not_exist (id TEXT)");
          },
        },
      ],
    });
    expect(hasTable(db, "should_not_exist")).toBe(false);
  });
});

describe("readDataVersion (A7)", () => {
  test("returns max executed migration version", async () => {
    const db = await createTestDb("1.1.0");
    expect(readDataVersion(db)).toEqual([1, 1, 0]);
  });

  test("returns undefined when no migrations executed", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "reflecta-migration-"));
    tempDirs.push(tempDir);
    const db = await createDBInstance(join(tempDir, "test.db"), {
      appVersion: "1.0.0",
      runMigrations: false,
    });
    expect(readDataVersion(db)).toBeUndefined();
  });
});
