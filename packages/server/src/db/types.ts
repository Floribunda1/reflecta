import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type ReflectaDb = LibSQLDatabase<typeof schema> & { $client: Client };
