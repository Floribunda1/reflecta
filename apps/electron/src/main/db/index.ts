import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  configureRetrievalEmbedding,
  createDBInstance,
  type ReflectaDb,
  type RetrievalEmbeddingConfig as ServerRetrievalEmbeddingConfig,
} from "@reflecta/server";
import { getContentStorageRoot, getReflectaProfile, getRetrievalConfig } from "../config";

let db: ReflectaDb;

function toServerRetrievalEmbeddingConfig(): Partial<ServerRetrievalEmbeddingConfig> | undefined {
  const config = getRetrievalConfig();
  if (config.embedding.provider === "disabled") return undefined;
  if (config.embedding.provider === "local-llama-cpp") {
    return {
      provider: "local-llama-cpp",
      modelId: config.embedding.modelId,
      modelPath: config.embedding.modelPath,
    };
  }
  return {
    provider: "openai-compatible",
    modelId: config.embedding.modelId,
    baseUrl: config.embedding.baseUrl,
    apiKey: config.embedding.apiKey,
  };
}

export const initializeDB = async () => {
  const contentStorageRoot = getContentStorageRoot();
  const dbPath = path.join(contentStorageRoot, "reflecta.db");
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH ??= path.join(contentStorageRoot, "retrieval-index");
  configureRetrievalEmbedding(toServerRetrievalEmbeddingConfig());
  if (!fs.existsSync(contentStorageRoot)) {
    fs.mkdirSync(contentStorageRoot, { recursive: true });
  }

  db = await createDBInstance(dbPath, {
    appVersion: app.getVersion(),
    runMigrations: getReflectaProfile() === "prod",
  });
};

export const getDBInstance = () => db;
