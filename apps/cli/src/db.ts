import { createDBInstance, type ReflectaDb } from "@reflecta/server";
import fs from "node:fs";
import { getReflectaProfile, resolveProfileDbPath } from "./profile";

let db: ReflectaDb | undefined;
let dbPath: string | undefined;

export function resolveDbPath(): string {
  return resolveProfileDbPath();
}

export async function initializeDb(): Promise<ReflectaDb> {
  if (db) return db;

  dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Reflecta database not found at "${dbPath}". Set REFLECTA_DB_PATH or run Reflecta first to initialize the database.`,
    );
  }

  db = await createDBInstance(dbPath, { runMigrations: getReflectaProfile() === "prod" });
  return db;
}

export function getDb(): ReflectaDb {
  if (!db) {
    throw new Error("Reflecta database has not been initialized.");
  }

  return db;
}

export function getResolvedDbPath(): string {
  dbPath ??= resolveDbPath();
  return dbPath;
}
