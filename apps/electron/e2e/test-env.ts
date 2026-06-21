import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type E2eTestEnv = {
  contentStorageRoot: string;
  dbPath: string;
};

export const e2eEnvFilePath = path.resolve(
  import.meta.dirname,
  "../node_modules/.cache/playwright/e2e-env.json",
);

export function createE2eTestEnv(): E2eTestEnv {
  const contentStorageRoot = path.join(os.tmpdir(), "reflecta-e2e-test", String(process.pid));
  const dbPath = path.join(contentStorageRoot, "reflecta.db");

  fs.rmSync(contentStorageRoot, { recursive: true, force: true });
  fs.mkdirSync(contentStorageRoot, { recursive: true });

  return { contentStorageRoot, dbPath };
}

export function saveE2eTestEnv(env: E2eTestEnv): void {
  fs.mkdirSync(path.dirname(e2eEnvFilePath), { recursive: true });
  fs.writeFileSync(e2eEnvFilePath, JSON.stringify(env, null, 2), "utf-8");
}

export function readE2eTestEnv(): E2eTestEnv {
  return JSON.parse(fs.readFileSync(e2eEnvFilePath, "utf-8")) as E2eTestEnv;
}

export function getE2eElectronEnv(baseEnv = process.env): NodeJS.ProcessEnv {
  const env = readE2eTestEnv();
  return {
    ...baseEnv,
    REFLECTA_PROFILE: "dev",
    REFLECTA_CONTENT_STORAGE_ROOT: env.contentStorageRoot,
  };
}

export function cleanupE2eTestEnv(): void {
  if (!fs.existsSync(e2eEnvFilePath)) return;
  const env = readE2eTestEnv();
  fs.rmSync(env.contentStorageRoot, { recursive: true, force: true });
  fs.rmSync(e2eEnvFilePath, { force: true });
}
