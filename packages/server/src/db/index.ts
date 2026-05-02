import { drizzle } from "drizzle-orm/libsql";
import type { ReflectaDb } from "../bff/electron/types";
import * as schema from "./schema";
import { performDbMigration } from "./migration";

export async function createDBInstance(dbPath: string): Promise<ReflectaDb> {
  const db = drizzle(`file:${dbPath}`, {
    schema,
  });
  await performDbMigration(db);
  return db;
}
