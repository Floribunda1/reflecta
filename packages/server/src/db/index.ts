import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { performDbMigration } from "./migration";
import type { ReflectaDb } from "./types";

export type { ReflectaDb } from "./types";

export interface CreateDBInstanceOptions {
  runMigrations?: boolean;
}

export async function createDBInstance(
  dbPath: string,
  options: CreateDBInstanceOptions = {},
): Promise<ReflectaDb> {
  const db = drizzle(`file:${dbPath}`, {
    schema,
  });
  if (options.runMigrations ?? true) {
    await performDbMigration(db);
  }
  return db;
}
