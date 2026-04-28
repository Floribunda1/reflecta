import { drizzle } from "drizzle-orm/libsql";
import type { ReflectaDb } from "../services/types.js";
import * as schema from "./schema.js";
import { performDbMigration } from "./migration.js";

export async function createDBInstance(dbPath: string): Promise<ReflectaDb> {
  const db = drizzle(`file:${dbPath}`, {
    schema,
  });
  await performDbMigration(db);
  return db;
}
