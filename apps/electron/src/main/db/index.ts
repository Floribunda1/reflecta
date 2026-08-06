import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  configureRetrievalEmbedding,
  configureRetrievalEmbeddingProviderFactory,
  createDBInstance,
  ensureStoreDataEnvironment,
  performDbMigration,
  type ReflectaDb,
} from "@reflecta/server";
import {
  getContentStorageRoot,
  getReflectaProfile,
  getRetrievalConfig,
  getRetrievalIndexPath,
} from "../config";
import { diagnosticErrorAttrs } from "../diagnostic-log";
import { writeDiagnosticEvent } from "../logger";
import { getRuntimeArg } from "../runtime-args";
import { createUtilityProcessEmbeddingProvider } from "../retrievalEmbeddingRunner";

let db: ReflectaDb;

export const initializeDB = async (): Promise<{ executed: string[] }> => {
  const contentStorageRoot = getContentStorageRoot();
  const dbPath = path.join(contentStorageRoot, "reflecta.db");
  const retrievalIndexPath = getRetrievalIndexPath();
  const profile = getReflectaProfile();
  // TS7 native-preview control-flow bug: a `let` declared inside try and
  // conditionally assigned after `await` is misread as never-in-scope at the
  // trailing return; declaring here keeps the exact same semantics.
  let executed: string[] = [];
  try {
    process.env.REFLECTA_RETRIEVAL_INDEX_PATH = retrievalIndexPath;
    configureRetrievalEmbeddingProviderFactory(createUtilityProcessEmbeddingProvider);
    configureRetrievalEmbedding(getRetrievalConfig().embedding);
    if (!fs.existsSync(contentStorageRoot)) {
      fs.mkdirSync(contentStorageRoot, { recursive: true });
    }

    db = await createDBInstance(dbPath, {
      appVersion: app.getVersion(),
      runMigrations: false,
    });
    // A7：Electron 是唯一的迁移执行者；显式跑 migration 以便按版本决定向量库 rebuild
    if (profile === "prod") {
      const result = await performDbMigration(db, app.getVersion());
      executed = result.executed;
    }
    if (!getRuntimeArg("reflecta-app-config-dir") && !getRuntimeArg("reflecta-content-root")) {
      ensureStoreDataEnvironment(db, profile);
    }
    writeDiagnosticEvent({
      level: "info",
      event: "app.db.initialized",
      scope: "db",
      attrs: {
        dbPath,
        contentStorageRoot,
        retrievalIndexPath,
        migrationMode: profile === "prod" ? "migration" : "schema-push",
      },
    });
  } catch (error) {
    writeDiagnosticEvent({
      level: "error",
      event: "app.db.failed",
      scope: "db",
      attrs: {
        dbPath,
        contentStorageRoot,
        retrievalIndexPath,
        migrationMode: profile === "prod" ? "migration" : "schema-push",
        ...diagnosticErrorAttrs(error),
      },
    });
    throw error;
  }
  return { executed };
};

export const getDBInstance = () => db;
