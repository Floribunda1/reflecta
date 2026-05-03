import { beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Each test file gets its own isolated database to avoid concurrent seed conflicts.
const TEST_DB_PATH = `/tmp/reflecta-cli-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`;
process.env.REFLECTA_DB_PATH = TEST_DB_PATH;

const SEED_SCRIPT = path.resolve(import.meta.dirname, "../scripts/seed-test-data.ts");

beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

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
