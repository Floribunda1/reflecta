import type { Client } from "@libsql/client";
import type { ReflectaDb } from "./types";

type Migration = {
  name: string;
  up: (client: Client) => Promise<void>;
};

// @ts-ignore - Vite's glob import is not typed in every build context, so we assert the type here.
const sqlMigrations = import.meta.glob("./migration/sql/*.sql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

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
