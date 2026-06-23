import { afterAll, beforeAll } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";

const SEED_SCRIPT = path.resolve(import.meta.dirname, "../scripts/seed-test-data.ts");
const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
const TEST_DIR = path.join(os.tmpdir(), "reflecta-cli-test", workerId, String(process.pid));
const TEST_DB_PATH = path.join(TEST_DIR, "reflecta.db");
const TEST_RETRIEVAL_INDEX_PATH = path.join(TEST_DIR, "retrieval-index");

fs.rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });
process.env.REFLECTA_DB_PATH = TEST_DB_PATH;
process.env.REFLECTA_RETRIEVAL_INDEX_PATH = TEST_RETRIEVAL_INDEX_PATH;

beforeAll(() => {
  try {
    execSync(`bun run "${SEED_SCRIPT}" "${TEST_DB_PATH}"`, {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 30000,
    });
  } catch (err) {
    throw new Error(`Seed script failed:\n${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`[test/setup] Seeded test database at ${TEST_DB_PATH}`);
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});
