import type { Database } from "libsql";
import fs from "node:fs";
import path from "node:path";
import type { ReflectaDb } from "./types";

export type MigrationContext = {
  db: ReflectaDb;
  /** 便捷执行一段 SQL（SQL 迁移的载体，代码迁移可选使用） */
  sql: (statement: string) => void;
  /** 标记：本次迁移后需要全量重建检索索引 */
  requestRetrievalIndexRebuild: () => void;
};

export type CodeMigration = {
  name: string;
  version: Version;
  up: (ctx: MigrationContext) => void | Promise<void>;
};

export type MigrationResult = {
  /** 本次实际执行的迁移名（按版本顺序）；空 = 数据已是最新 */
  executed: string[];
};

type Migration = {
  name: string;
  version: Version;
  up: (ctx: MigrationContext) => void | Promise<void>;
};

type Version = readonly [number, number, number];

const DEFAULT_APP_VERSION = "1.1.0";
const appVersionPattern = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
// 兼容历史 name（v1.0.0.sql）；新迁移 name 可不带后缀
const migrationNamePattern = /^v(\d+)\.(\d+)\.(\d+)(?:\.sql)?$/;

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

/** 从 migration/code/ 加载 code migrations（按版本排序） */
async function loadCodeMigrations(): Promise<Migration[]> {
  const toMigration = (mod: { default: CodeMigration } | CodeMigration): Migration => {
    const code =
      "default" in mod ? (mod as { default: CodeMigration }).default : (mod as CodeMigration);
    return { name: code.name, version: code.version, up: code.up };
  };

  // @ts-ignore import.meta.glob is provided by Vite when bundled for Electron.
  if (typeof import.meta.glob === "function") {
    // @ts-ignore import.meta.glob is provided by Vite when bundled for Electron.
    const mods = import.meta.glob("./migration/code/*.ts", {
      eager: true,
      import: "default",
    }) as Record<string, CodeMigration>;
    return Object.values(mods)
      .map((m) => ({ name: m.name, version: m.version, up: m.up }))
      .sort((a, b) => compareVersions(a.version, b.version));
  }

  const migrationDir = path.resolve(import.meta.dirname, "migration/code");
  const files = fs.readdirSync(migrationDir).filter((file) => file.endsWith(".ts"));
  const mods = await Promise.all(
    files.map(
      (file) => import(path.join(migrationDir, file)) as Promise<{ default: CodeMigration }>,
    ),
  );
  return mods.map(toMigration).sort((a, b) => compareVersions(a.version, b.version));
}

let codeMigrationsCache: Promise<Migration[]> | undefined;

function getCodeMigrations(): Promise<Migration[]> {
  codeMigrationsCache ??= loadCodeMigrations();
  return codeMigrationsCache;
}

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

/** 读取数据当前版本（_migrations 表最大已执行迁移版本）；无记录返回 undefined */
export function readDataVersion(db: ReflectaDb): Version | undefined {
  const names = listExecutedMigrations(db.$client);
  if (names.length === 0) return undefined;
  const versions = names
    .map((name) => {
      try {
        return parseMigrationVersion(name);
      } catch {
        return undefined;
      }
    })
    .filter((v): v is Version => v !== undefined);
  if (versions.length === 0) return undefined;
  return versions.sort(compareVersions).at(-1);
}

export async function performDbMigration(
  db: ReflectaDb,
  appVersion = DEFAULT_APP_VERSION,
  options: { codeMigrations?: CodeMigration[] } = {},
): Promise<MigrationResult> {
  const client = db.$client;
  const executed = new Set(listExecutedMigrations(client));
  const targetVersion = parseAppVersion(appVersion);

  const allMigrations: Migration[] = [
    ...(await getCodeMigrations()),
    ...(options.codeMigrations ?? []).map((code) => ({
      name: code.name,
      version: code.version,
      up: code.up,
    })),
  ].sort((a, b) => compareVersions(a.version, b.version));

  const context: MigrationContext = {
    db,
    sql: (statement) => {
      client.exec(statement);
    },
    requestRetrievalIndexRebuild: () => {
      // 保留 API：迁移可显式声明需要重建检索索引（Electron 按版本执行，见启动逻辑）
    },
  };

  const executedThisRun: string[] = [];
  for (const migration of allMigrations) {
    if (compareVersions(migration.version, targetVersion) > 0) continue;
    if (executed.has(migration.name)) continue;
    await migration.up(context);
    logMigration(client, migration.name);
    executedThisRun.push(migration.name);
  }

  return { executed: executedThisRun };
}
