import type { Client } from "@libsql/client";
import { Umzug } from "umzug";
import type { ReflectaDb } from "../services/types.js";

// @ts-expect-error - Vite's glob import is not typed, so we assert the type here.
const sqlMigrations = import.meta.glob("./migration/sql/*.sql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

export async function performDbMigration(db: ReflectaDb): Promise<void> {
  const client = db.$client as Client;

  const migrator = new Umzug<Client>({
    migrations: Object.entries(sqlMigrations)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([filePath, sql]) => ({
        name: filePath.replace("./migration/sql/", ""),
        up: async ({ context }: { context: Client }) => {
          await context.executeMultiple(sql);
        },
        down: async () => {
          // Down migrations are not supported.
        },
      })),
    context: client,
    storage: {
      async executed({ context }: { context: Client }) {
        await context.execute(
          `CREATE TABLE IF NOT EXISTS _migrations (name TEXT NOT NULL PRIMARY KEY, run_at TEXT NOT NULL)`,
        );
        const result = await context.execute(`SELECT name FROM _migrations ORDER BY run_at ASC`);
        return result.rows.map((r) => r.name as string);
      },
      async logMigration({ name, context }: { name: string; context: Client }) {
        await context.execute({
          sql: `INSERT INTO _migrations (name, run_at) VALUES (?, ?)`,
          args: [name, new Date().toISOString()],
        });
      },
      async unlogMigration({ name, context }: { name: string; context: Client }) {
        await context.execute({
          sql: `DELETE FROM _migrations WHERE name = ?`,
          args: [name],
        });
      },
    },
    logger: console,
  });

  await migrator.up();
}
