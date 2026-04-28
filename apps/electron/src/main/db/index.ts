import fs from "node:fs";
import path from "node:path";
import { createDBInstance, performDbMigration, type ReflectaDb } from "@reflecta/server";
import { getStorageRoot } from "../config";

let db: ReflectaDb;

export const initializeDB = async () => {
  const storageRoot = getStorageRoot();
  const dbPath = path.join(storageRoot, "reflecta.db");
  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }

  db = createDBInstance(dbPath);
  await performDbMigration(db);
};

export const getDBInstance = () => db;
