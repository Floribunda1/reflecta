import type { Database } from "libsql";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type ReflectaDb = BetterSQLite3Database<typeof schema> & { $client: Database };
