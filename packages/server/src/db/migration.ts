import type { Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import type { ReflectaDb } from "./types";

type Migration = {
  name: string;
  up: (client: Client) => Promise<void>;
};

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

const migrations: Migration[] = Object.entries(sqlMigrations)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([filePath, sql]) => ({
    name: filePath.replace("./migration/sql/", ""),
    up: async (client) => {
      await client.executeMultiple(sql);
    },
  }));

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT NOT NULL PRIMARY KEY, run_at TEXT NOT NULL)`,
  );
}

async function listExecutedMigrations(client: Client): Promise<string[]> {
  await ensureMigrationTable(client);
  const result = await client.execute(`SELECT name FROM _migrations ORDER BY run_at ASC`);
  return result.rows.map((row) => row.name as string);
}

async function logMigration(client: Client, name: string): Promise<void> {
  await client.execute({
    sql: `INSERT INTO _migrations (name, run_at) VALUES (?, ?)`,
    args: [name, new Date().toISOString()],
  });
}

export async function performDbMigration(db: ReflectaDb): Promise<void> {
  const client = db.$client as Client;
  const executed = new Set(await listExecutedMigrations(client));

  for (const migration of migrations) {
    if (executed.has(migration.name)) continue;
    await migration.up(client);
    await logMigration(client, migration.name);
  }
}
