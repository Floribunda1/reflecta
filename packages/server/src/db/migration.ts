import type { Database } from "libsql";
import fs from "node:fs";
import path from "node:path";
import type { ReflectaDb } from "./types";

type Migration = {
  name: string;
  version: Version;
  up: (client: Database) => void;
};

type Version = readonly [number, number, number];

const DEFAULT_APP_VERSION = "1.0.0";
const appVersionPattern = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
const migrationNamePattern = /^v(\d+)\.(\d+)\.(\d+)\.sql$/;

function readSqlMigrationsFromFs(): Record<string, string> {
  const migrationDir = path.resolve(import.meta.dirname, "migration/sql");
  return Object.fromEntries(
    fs
      .readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [
        `./migration/sql/${file}`,
        fs.readFileSync(path.join(migrationDir, file), "utf-8"),
      ]),
  );
}

const sqlMigrations =
  // @ts-ignore import.meta.glob is provided by Vite when bundled for Electron.
  typeof import.meta.glob === "function"
    ? // @ts-ignore import.meta.glob is provided by Vite when bundled for Electron.
      (import.meta.glob("./migration/sql/*.sql", {
        eager: true,
        import: "default",
        query: "?raw",
      }) as Record<string, string>)
    : readSqlMigrationsFromFs();

export function parseAppVersion(version: string): Version {
  const match = appVersionPattern.exec(version);
  if (!match) throw new Error(`Invalid app version "${version}". Expected x.y.z.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function parseMigrationVersion(name: string): Version {
  const match = migrationNamePattern.exec(name);
  if (!match) throw new Error(`Invalid migration "${name}". Expected vX.Y.Z.sql.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a: Version, b: Version): number {
  for (let index = 0; index < 3; index++) {
    const diff = a[index] - b[index];
    if (diff !== 0) return diff;
  }
  return 0;
}

const migrations: Migration[] = Object.entries(sqlMigrations)
  .map(([filePath, sql]) => ({
    name: path.basename(filePath),
    version: parseMigrationVersion(path.basename(filePath)),
    up: (client: Database) => {
      client.exec(sql);
    },
  }))
  .sort((a, b) => compareVersions(a.version, b.version));

function ensureMigrationTable(client: Database): void {
  client
    .prepare(
      `CREATE TABLE IF NOT EXISTS _migrations (name TEXT NOT NULL PRIMARY KEY, run_at TEXT NOT NULL)`,
    )
    .run();
}

function listExecutedMigrations(client: Database): string[] {
  ensureMigrationTable(client);
  const rows = client
    .prepare<[]>(`SELECT name FROM _migrations ORDER BY run_at ASC`)
    .all() as Array<{
    name: string;
  }>;
  return rows.map((row) => row.name);
}

function logMigration(client: Database, name: string): void {
  client
    .prepare<[string, string]>(`INSERT INTO _migrations (name, run_at) VALUES (?, ?)`)
    .run(name, new Date().toISOString());
}

export async function performDbMigration(
  db: ReflectaDb,
  appVersion = DEFAULT_APP_VERSION,
): Promise<void> {
  const client = db.$client;
  const executed = new Set(listExecutedMigrations(client));
  const targetVersion = parseAppVersion(appVersion);

  for (const migration of migrations) {
    if (compareVersions(migration.version, targetVersion) > 0) continue;
    if (executed.has(migration.name)) continue;
    migration.up(client);
    logMigration(client, migration.name);
  }
}
