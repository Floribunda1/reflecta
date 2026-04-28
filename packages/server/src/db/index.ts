import { drizzle } from "drizzle-orm/libsql";
import type { ReflectaDb } from "../services/types.js";
import * as schema from "./schema.js";

export function createDBInstance(dbPath: string): ReflectaDb {
  return drizzle(`file:${dbPath}`, {
    schema,
  });
}
