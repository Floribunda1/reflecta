import {
  compareVersions,
  configureRetrievalEmbedding,
  createDBInstance,
  ensureStoreDataEnvironment,
  parseAppVersion,
  readDataVersion,
  type ReflectaDb,
  type RetrievalEmbeddingConfig,
} from "@reflecta/server";
import fs from "node:fs";
import path from "node:path";
import { resolveCliRuntimePaths, type CliRuntimeOptions } from "./runtime";

let db: ReflectaDb | undefined;
let dbPath: string | undefined;
let activeRuntimeKey: string | undefined;

function readRetrievalEmbeddingConfig(
  appConfigDir: string,
): Partial<RetrievalEmbeddingConfig> | undefined {
  const configPath = path.join(appConfigDir, "reflecta-config.json");
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

export function resolveDbPath(options: CliRuntimeOptions = {}): string {
  return resolveCliRuntimePaths(options).dbPath;
}

export async function initializeDb(
  options: CliRuntimeOptions & { requiresFullStore?: boolean } = {},
): Promise<ReflectaDb> {
  const runtime = resolveCliRuntimePaths(options);
  const runtimeKey = JSON.stringify({
    dbPath: runtime.dbPath,
    appConfigDir: runtime.appConfigDir,
    contentStorageRoot: runtime.contentStorageRoot,
    storeMode: runtime.storeMode,
  });
  if (db && activeRuntimeKey === runtimeKey) return db;

  if (options.requiresFullStore && runtime.storeMode !== "full-store") {
    throw new Error(
      "This command requires a full Reflecta content storage root. Pass --content-root instead of --db.",
    );
  }

  dbPath = runtime.dbPath;
  activeRuntimeKey = runtimeKey;
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH = runtime.retrievalIndexPath;
  configureRetrievalEmbedding(readRetrievalEmbeddingConfig(runtime.appConfigDir));

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Reflecta database not found at "${dbPath}". Pass --content-root/--db or run Reflecta first to initialize the database.`,
    );
  }

  const packageJson = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
  ) as { version: string };

  db = await createDBInstance(dbPath, {
    appVersion: packageJson.version,
    runMigrations: false,
  });
  if (runtime.migrationPolicy === "verify") {
    verifyDataVersion(db, packageJson.version);
  }
  if (
    runtime.storeMode === "full-store" &&
    !options.appConfigDir &&
    !options.contentRoot &&
    !options.db
  ) {
    ensureStoreDataEnvironment(db, runtime.dataTarget);
  }
  return db;
}

/** CLI 只校验数据版本，不执行迁移（Electron 是唯一迁移执行者）。数据版本低于 CLI 期望时拒绝。 */
function verifyDataVersion(db: ReflectaDb, cliVersion: string): void {
  const dataVersion = readDataVersion(db);
  if (dataVersion === undefined) {
    throw new Error(
      `数据尚未初始化（无迁移记录）。请先打开 Reflecta 完成初始化与数据迁移，再使用 CLI。`,
    );
  }
  const expected = parseAppVersion(cliVersion);
  if (compareVersions(dataVersion, expected) < 0) {
    throw new Error(
      `数据版本低于 CLI 期望：数据 v${dataVersion.join(".")} < CLI v${cliVersion}。` +
        `请先打开 Reflecta（Electron）完成数据迁移，再使用 CLI。`,
    );
  }
}

export function getDb(): ReflectaDb {
  if (!db) {
    throw new Error("Reflecta database has not been initialized.");
  }

  return db;
}

export function getResolvedDbPath(options: CliRuntimeOptions = {}): string {
  dbPath ??= resolveDbPath(options);
  return dbPath;
}

export function getActiveRuntimeKey(): string | undefined {
  return activeRuntimeKey;
}
