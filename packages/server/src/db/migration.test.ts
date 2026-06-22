import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createDBInstance, type ReflectaDb } from ".";
import { compareVersions, parseAppVersion, parseMigrationVersion } from "./migration";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs = [];
});

async function createTestDb(appVersion: string) {
  const tempDir = await mkdtemp(join(tmpdir(), "reflecta-migration-"));
  tempDirs.push(tempDir);
  return createDBInstance(join(tempDir, "test.db"), { appVersion });
}

function hasTable(db: ReflectaDb, tableName: string) {
  const row = db.$client
    .prepare<[string]>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(tableName) as { name: string } | null;
  return Boolean(row);
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
});
