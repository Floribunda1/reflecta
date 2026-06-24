import {
  configureRetrievalEmbedding,
  createDBInstance,
  type ReflectaDb,
  type RetrievalEmbeddingConfig,
} from "@reflecta/server";
import fs from "node:fs";
import path from "node:path";
import { getAppConfigDir, getReflectaProfile, resolveProfileDbPath } from "./profile";

let db: ReflectaDb | undefined;
let dbPath: string | undefined;

function readRetrievalEmbeddingConfig(): Partial<RetrievalEmbeddingConfig> | undefined {
  const configPath = path.join(getAppConfigDir(), "reflecta-config.json");
  if (!fs.existsSync(configPath)) return undefined;

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
      retrieval?: { embedding?: Partial<RetrievalEmbeddingConfig> };
    };
    const embedding = parsed.retrieval?.embedding;
    return embedding?.provider && embedding.provider !== "disabled" ? embedding : undefined;
  } catch {
    return undefined;
  }
}

export function resolveDbPath(): string {
  return resolveProfileDbPath();
}

export async function initializeDb(): Promise<ReflectaDb> {
  if (db) return db;

  dbPath = resolveDbPath();
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH ??= path.join(path.dirname(dbPath), "retrieval-index");
  configureRetrievalEmbedding(readRetrievalEmbeddingConfig());

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Reflecta database not found at "${dbPath}". Set REFLECTA_DB_PATH or run Reflecta first to initialize the database.`,
    );
  }

  const packageJson = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
  ) as { version: string };

  db = await createDBInstance(dbPath, {
    appVersion: packageJson.version,
    runMigrations: getReflectaProfile() === "prod",
  });
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
