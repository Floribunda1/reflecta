import fs from "node:fs";
import path from "node:path";
import { createDBInstance, type ReflectaDb } from "@reflecta/server";
import { getReflectaProfile, getStorageRoot } from "../config";

let db: ReflectaDb;

export const initializeDB = async () => {
  const storageRoot = getStorageRoot();
  const dbPath = path.join(storageRoot, "reflecta.db");
  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }

  db = await createDBInstance(dbPath, { runMigrations: getReflectaProfile() === "prod" });
};

export const getDBInstance = () => db;
