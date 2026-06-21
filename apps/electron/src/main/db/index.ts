import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { createDBInstance, type ReflectaDb } from "@reflecta/server";
import { getContentStorageRoot, getReflectaProfile } from "../config";

let db: ReflectaDb;

export const initializeDB = async () => {
  const contentStorageRoot = getContentStorageRoot();
  const dbPath = path.join(contentStorageRoot, "reflecta.db");
  if (!fs.existsSync(contentStorageRoot)) {
    fs.mkdirSync(contentStorageRoot, { recursive: true });
  }

  db = await createDBInstance(dbPath, {
    appVersion: app.getVersion(),
    runMigrations: getReflectaProfile() === "prod",
  });
};

export const getDBInstance = () => db;
