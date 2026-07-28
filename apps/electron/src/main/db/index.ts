import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  configureRetrievalEmbedding,
  configureRetrievalEmbeddingProviderFactory,
  createDBInstance,
  ensureStoreDataEnvironment,
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

export const initializeDB = async () => {
  const contentStorageRoot = getContentStorageRoot();
  const dbPath = path.join(contentStorageRoot, "reflecta.db");
  const retrievalIndexPath = getRetrievalIndexPath();
  const profile = getReflectaProfile();
  try {
    process.env.REFLECTA_RETRIEVAL_INDEX_PATH = retrievalIndexPath;
    configureRetrievalEmbeddingProviderFactory(createUtilityProcessEmbeddingProvider);
    configureRetrievalEmbedding(getRetrievalConfig().embedding);
    if (!fs.existsSync(contentStorageRoot)) {
      fs.mkdirSync(contentStorageRoot, { recursive: true });
    }

    db = await createDBInstance(dbPath, {
      appVersion: app.getVersion(),
      runMigrations: profile === "prod",
    });
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
};

export const getDBInstance = () => db;
