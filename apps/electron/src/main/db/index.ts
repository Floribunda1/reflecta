import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { performMigration } from "./migration";
import * as schema from "./schema";
import { getStorageRoot } from "../config";

let db: ReturnType<typeof drizzle>;

export const initializeDB = async () => {
  const storageRoot = getStorageRoot();
  const dbPath = path.join(storageRoot, "reflecta.db");
  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }

  db = drizzle(`file:${dbPath}`, {
    schema,
  });
  await performMigration();
};

export const getDBInstance = () => db!;
