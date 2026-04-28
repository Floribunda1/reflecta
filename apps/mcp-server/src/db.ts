import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createDBInstance, type ReflectaDb } from "@reflecta/server";

let db: ReflectaDb | undefined;

function resolveDefaultDbPath(): string {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "reflecta", "reflecta.db");
  }
  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "reflecta", "reflecta.db");
  }
  const xdgData = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
  return path.join(xdgData, "reflecta", "reflecta.db");
}

function resolveStorageRootFromConfig(): string | undefined {
  const platform = os.platform();
  const home = os.homedir();

  let configDir: string;
  if (platform === "darwin") {
    configDir = path.join(home, "Library", "Application Support", "reflecta");
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    configDir = path.join(appData, "reflecta");
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
    configDir = path.join(xdgConfig, "reflecta");
  }

  const configPath = path.join(configDir, "reflecta-config.json");
  if (!fs.existsSync(configPath)) return undefined;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw) as { storagePath?: string };
    return config.storagePath;
  } catch {
    return undefined;
  }
}

export function getDbPath(): string {
  if (process.env.REFLECTA_DB_PATH) {
    return process.env.REFLECTA_DB_PATH;
  }
  const fromConfig = resolveStorageRootFromConfig();
  if (fromConfig) {
    return path.join(fromConfig, "reflecta.db");
  }
  return resolveDefaultDbPath();
}

export async function initDB() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Reflecta database not found at "${dbPath}". ` +
        `Set REFLECTA_DB_PATH or run the Reflecta desktop app first to initialize the database.`,
    );
  }
  db = await createDBInstance(dbPath);
}

export function getDB() {
  if (!db) {
    throw new Error("DB not initialized. Call initDB() first.");
  }
  return db;
}
