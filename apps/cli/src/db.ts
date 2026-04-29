import { createDBInstance, type ReflectaDb } from "@reflecta/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let db: ReflectaDb | undefined;
let dbPath: string | undefined;

function getReflectaDataDir(): string {
  const home = os.homedir();

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "reflecta");
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "reflecta");
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "reflecta");
}

function getReflectaConfigDir(): string {
  const home = os.homedir();

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "reflecta");
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "reflecta");
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "reflecta");
}

function readStoragePathFromConfig(): string | undefined {
  const configPath = path.join(getReflectaConfigDir(), "reflecta-config.json");
  if (!fs.existsSync(configPath)) return undefined;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as { storagePath?: unknown };
    return typeof parsed.storagePath === "string" && parsed.storagePath.length > 0
      ? parsed.storagePath
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveDbPath(): string {
  if (process.env.REFLECTA_DB_PATH) {
    return path.resolve(process.env.REFLECTA_DB_PATH);
  }

  const storagePath = readStoragePathFromConfig();
  if (storagePath) {
    return path.join(storagePath, "reflecta.db");
  }

  return path.join(getReflectaDataDir(), "reflecta.db");
}

export async function initializeDb(): Promise<ReflectaDb> {
  if (db) return db;

  dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Reflecta database not found at "${dbPath}". Set REFLECTA_DB_PATH or run Reflecta first to initialize the database.`,
    );
  }

  db = await createDBInstance(dbPath);
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
