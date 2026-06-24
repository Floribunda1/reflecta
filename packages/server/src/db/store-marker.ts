import type { ReflectaDb } from "./types";

export type StoreDataEnvironment = "prod" | "dev" | "test";

const STORE_TABLE = "_reflecta_store";
const DATA_ENVIRONMENT_KEY = "data_environment";

function hasStoreTable(db: ReflectaDb): boolean {
  const row = db.$client
    .prepare<[string]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(STORE_TABLE) as { name: string } | null;
  return Boolean(row);
}

function ensureStoreTable(db: ReflectaDb): void {
  db.$client
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${STORE_TABLE} (key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL)`,
    )
    .run();
}

export function readStoreDataEnvironment(db: ReflectaDb): StoreDataEnvironment | undefined {
  if (!hasStoreTable(db)) return undefined;
  const row = db.$client
    .prepare<[string]>(`SELECT value FROM ${STORE_TABLE} WHERE key = ? LIMIT 1`)
    .get(DATA_ENVIRONMENT_KEY) as { value: string } | null;
  return row?.value === "prod" || row?.value === "dev" || row?.value === "test"
    ? row.value
    : undefined;
}

export function ensureStoreDataEnvironment(
  db: ReflectaDb,
  dataEnvironment: StoreDataEnvironment,
): void {
  const existing = readStoreDataEnvironment(db);
  if (existing && existing !== dataEnvironment) {
    throw new Error(
      `Reflecta store data_environment is ${existing}, but this runtime resolved ${dataEnvironment}.`,
    );
  }

  ensureStoreTable(db);
  db.$client
    .prepare<[string, string]>(
      `INSERT INTO ${STORE_TABLE} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(DATA_ENVIRONMENT_KEY, dataEnvironment);
}
