import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { performDbMigration } from "./migration";
import type { ReflectaDb } from "./types";

export async function createDBInstance(dbPath: string): Promise<ReflectaDb> {
  const db = drizzle(`file:${dbPath}`, {
    schema,
  });
  await performDbMigration(db);
  return db;
}
