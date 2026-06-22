import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_E2E_AI_PROVIDER = "opencode-go";
const DEFAULT_E2E_AI_MODEL = "deepseek-v4-flash";
const envTestLocalPath = path.resolve(import.meta.dirname, "../../../.env.test.local");

export type E2eTestEnv = {
  appConfigDir: string;
  contentStorageRoot: string;
  dbPath: string;
};

export type E2eAiEnv = {
  apiKey: string;
  providerId: string;
  modelId: string;
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

function parseDotEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readEnvTestLocal(): NodeJS.ProcessEnv {
  if (!fs.existsSync(envTestLocalPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envTestLocalPath, "utf-8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return [];
        const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
        return match ? [[match[1]!, parseDotEnvValue(match[2] ?? "")]] : [];
      }),
  );
}

export function getE2eProcessEnv(baseEnv = process.env): NodeJS.ProcessEnv {
  return { ...readEnvTestLocal(), ...baseEnv };
}

export function getE2eAiEnv(baseEnv = process.env): E2eAiEnv {
  const env = getE2eProcessEnv(baseEnv);
  return {
    apiKey: env.REFLECTA_E2E_AI_API_KEY || "",
    providerId: env.REFLECTA_E2E_AI_PROVIDER || DEFAULT_E2E_AI_PROVIDER,
    modelId: env.REFLECTA_E2E_AI_MODEL || DEFAULT_E2E_AI_MODEL,
  };
}

export function getE2eElectronEnv(baseEnv = process.env): NodeJS.ProcessEnv {
  const env = readE2eTestEnv();
  return {
    ...getE2eProcessEnv(baseEnv),
    REFLECTA_PROFILE: "dev",
    REFLECTA_APP_CONFIG_DIR: env.appConfigDir,
    REFLECTA_CONTENT_STORAGE_ROOT: env.contentStorageRoot,
  };
}

export function hasE2eAiConfig(baseEnv = process.env): boolean {
  return Boolean(getE2eAiEnv(baseEnv).apiKey);
}

export function writeE2eAiConfig(baseEnv = process.env): boolean {
  const { apiKey, providerId, modelId } = getE2eAiEnv(baseEnv);
  if (!apiKey) return false;

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
