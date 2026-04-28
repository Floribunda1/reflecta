import type { Client } from "@libsql/client";
import { Umzug } from "umzug";
import { getDBInstance } from "..";

// SQL migration files are imported as raw strings at build time so they are
// correctly bundled and available in the packaged Electron app.
const sqlMigrations = import.meta.glob<string>("./sql/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
});

export const performMigration = async () => {
  const db = getDBInstance();
  const client = db.$client as Client;

  const migrations = Object.keys(sqlMigrations)
    .map((p) => p.replace("./sql/", ""))
    .sort()
    .map((name) => ({
      name,
      up: async ({ context }: { context: Client }) => {
        await context.executeMultiple(sqlMigrations[`./sql/${name}`]);
      },
      down: async () => {
        // Down migrations are not supported
      },
    }));

  const migrator = new Umzug<Client>({
    migrations,
    context: client,
    storage: {
      async executed({ context }) {
        await context.execute(
          `CREATE TABLE IF NOT EXISTS _migrations (name TEXT NOT NULL PRIMARY KEY, run_at TEXT NOT NULL)`,
        );
        const result = await context.execute(`SELECT name FROM _migrations ORDER BY run_at ASC`);
        return result.rows.map((r) => r.name as string);
      },
      async logMigration({ name, context }) {
        await context.execute({
          sql: `INSERT INTO _migrations (name, run_at) VALUES (?, ?)`,
          args: [name, new Date().toISOString()],
        });
      },
      async unlogMigration({ name, context }) {
        await context.execute({
          sql: `DELETE FROM _migrations WHERE name = ?`,
          args: [name],
        });
      },
    },
    logger: console,
  });

  await migrator.up();
};
