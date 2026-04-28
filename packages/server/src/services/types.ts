import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema.js";

export type ReflectaDb = LibSQLDatabase<typeof schema> & { $client: Client };

export type ReflectaServerContext = {
  getDb: () => ReflectaDb;
};
