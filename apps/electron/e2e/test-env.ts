import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type E2eTestEnv = {
  appConfigDir: string;
  contentStorageRoot: string;
  dbPath: string;
};

export const e2eEnvFilePath = path.resolve(
  import.meta.dirname,
  "../node_modules/.cache/playwright/e2e-env.json",
);

export function createE2eTestEnv(): E2eTestEnv {
  const root = path.join(os.tmpdir(), "reflecta-e2e-test", String(process.pid));
  const appConfigDir = path.join(root, "config");
  const contentStorageRoot = path.join(root, "content");
  const dbPath = path.join(contentStorageRoot, "reflecta.db");

  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(appConfigDir, { recursive: true });
  fs.mkdirSync(contentStorageRoot, { recursive: true });

  return { appConfigDir, contentStorageRoot, dbPath };
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
    REFLECTA_APP_CONFIG_DIR: env.appConfigDir,
    REFLECTA_CONTENT_STORAGE_ROOT: env.contentStorageRoot,
  };
}

export function hasE2eAiConfig(baseEnv = process.env): boolean {
  return Boolean(baseEnv.REFLECTA_E2E_AI_API_KEY || baseEnv.OPENAI_API_KEY);
}

export function writeE2eAiConfig(baseEnv = process.env): boolean {
  const apiKey = baseEnv.REFLECTA_E2E_AI_API_KEY || baseEnv.OPENAI_API_KEY;
  if (!apiKey) return false;

  const providerId = baseEnv.REFLECTA_E2E_AI_PROVIDER || "openai";
  const modelId = baseEnv.REFLECTA_E2E_AI_MODEL || "gpt-4o-mini";
  const env = readE2eTestEnv();
  fs.mkdirSync(env.appConfigDir, { recursive: true });
  fs.writeFileSync(
    path.join(env.appConfigDir, "reflecta-config.json"),
    JSON.stringify(
      {
        ai: {
          providers: [{ id: providerId, apiKey, models: [{ id: modelId }] }],
          activeAgentModel: { providerId, modelId },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
  return true;
}

export function cleanupE2eTestEnv(): void {
  if (!fs.existsSync(e2eEnvFilePath)) return;
  const env = readE2eTestEnv();
  fs.rmSync(env.contentStorageRoot, { recursive: true, force: true });
  fs.rmSync(e2eEnvFilePath, { force: true });
}
