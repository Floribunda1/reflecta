import LibsqlDatabase from "libsql";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { performDbMigration } from "./migration";
import type { ReflectaDb } from "./types";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";

export type { ReflectaDb } from "./types";
export * from "./store-marker";

export interface CreateDBInstanceOptions {
  runMigrations?: boolean;
  appVersion?: string;
}

export async function createDBInstance(
  dbPath: string,
  options: CreateDBInstanceOptions = {},
): Promise<ReflectaDb> {
  const client = new LibsqlDatabase(dbPath, { timeout: 5000 });
  client.pragma("journal_mode = WAL");
  client.pragma("busy_timeout = 5000");
  client.pragma("foreign_keys = ON");

  const db = drizzle(client as unknown as BetterSqliteDatabase, {
    schema,
  }) as ReflectaDb;
  if (options.runMigrations === true) {
    await performDbMigration(db, options.appVersion);
  }
  return db;
}
