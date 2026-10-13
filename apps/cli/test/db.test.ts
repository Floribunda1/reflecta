import { createDBInstance, readDataVersion, type ReflectaDb } from "@reflecta/server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
const connections: ReflectaDb[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reflecta-cli-version-"));
  vi.resetModules();
});

afterEach(() => {
  for (const db of connections.splice(0)) db.$client.close();
  rmSync(root, { recursive: true, force: true });
});

async function prepareDb(appVersion: string, runMigrations = true) {
  const db = await createDBInstance(join(root, "reflecta.db"), { appVersion, runMigrations });
  connections.push(db);
  return db;
}

function options(buildKind: "release" | "source" = "release") {
  return { contentRoot: root, appConfigDir: join(root, "config"), buildKind };
}

describe("CLI data version compatibility", () => {
  it("opens the latest migrated database after an application-only patch release", async () => {
    await prepareDb("2.0.7");
    const { initializeDb } = await import("../src/db");
    const db = await initializeDb(options());
    connections.push(db);
    expect(readDataVersion(db)).toEqual([2, 0, 0]);
  });

  it("rejects a complete older database repeatedly without migrating or changing its content", async () => {
    const db = await prepareDb("1.3.5");
    db.$client.exec(
      "INSERT INTO understandings (id, title, body, created_at, updated_at) VALUES ('sentinel', 'Keep me', 'Original content', '2026-01-01', '2026-01-01')",
    );
    const migrations = db.$client.prepare("SELECT * FROM _migrations ORDER BY name").all();
    const content = db.$client.prepare("SELECT * FROM understandings").all();
    const { initializeDb } = await import("../src/db");
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(initializeDb(options())).rejects.toThrow("数据版本低于 CLI 期望");
    }
    expect(db.$client.prepare("SELECT * FROM _migrations ORDER BY name").all()).toEqual(migrations);
    expect(db.$client.prepare("SELECT * FROM understandings").all()).toEqual(content);
    expect(readDataVersion(db)).toEqual([1, 3, 5]);
  });

  it("does not reuse a source connection to bypass release verification", async () => {
    await prepareDb("1.3.5");
    const { initializeDb } = await import("../src/db");
    connections.push(await initializeDb(options("source")));
    await expect(initializeDb(options())).rejects.toThrow("数据版本低于 CLI 期望");
  });

  it("rejects an uninitialized database", async () => {
    await prepareDb("2.0.7", false);
    const { initializeDb } = await import("../src/db");
    await expect(initializeDb(options())).rejects.toThrow("数据尚未初始化");
  });
});
