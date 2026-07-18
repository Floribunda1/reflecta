import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "@playwright/test";

const DEFAULT_E2E_AI_PROVIDER = "deepseek";
const DEFAULT_E2E_AI_MODEL = "deepseek-v4-flash";
const envTestLocalPath = path.resolve(import.meta.dirname, "../../../.env.test.local");

export type E2eTestEnv = {
  appConfigDir: string;
  contentStorageRoot: string;
  dbPath: string;
  userDataDir: string;
};

export type E2eAiEnv = {
  apiKey: string;
  providerId: string;
  modelId: string;
};

type E2eTestRun = {
  runRoot: string;
};

export const e2eEnvFilePath = path.resolve(
  import.meta.dirname,
  "../node_modules/.cache/playwright/e2e-env.json",
);

let cachedEnv: E2eTestEnv | undefined;
let cachedEnvId: string | undefined;

export function createE2eTestRun(): E2eTestRun {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-e2e-test-"));
  return { runRoot };
}

export function saveE2eTestRun(run: E2eTestRun): void {
  fs.mkdirSync(path.dirname(e2eEnvFilePath), { recursive: true });
  fs.writeFileSync(e2eEnvFilePath, JSON.stringify(run, null, 2), "utf-8");
}

function readE2eTestRun(): E2eTestRun {
  return JSON.parse(fs.readFileSync(e2eEnvFilePath, "utf-8")) as E2eTestRun;
}

function getFallbackEnvId(): string {
  return String(
    process.env.TEST_WORKER_INDEX ?? process.env.TEST_PARALLEL_INDEX ?? process.pid,
  ).replace(/[^A-Za-z0-9_-]/g, "_");
}

function getCurrentEnvId(): string {
  try {
    const info = test.info();
    const raw = [
      info.project.name,
      info.workerIndex,
      info.repeatEachIndex,
      info.retry,
      ...info.titlePath,
    ].join("\0");
    return createHash("sha1").update(raw).digest("hex").slice(0, 16);
  } catch {
    return getFallbackEnvId();
  }
}

function createTestEnv(envId: string): E2eTestEnv {
  const root = path.join(readE2eTestRun().runRoot, envId);
  const appConfigDir = path.join(root, "config");
  const contentStorageRoot = path.join(root, "content");
  const dbPath = path.join(contentStorageRoot, "reflecta.db");
  const userDataDir = path.join(root, "user-data");

  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(appConfigDir, { recursive: true });
  fs.mkdirSync(contentStorageRoot, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  return { appConfigDir, contentStorageRoot, dbPath, userDataDir };
}

function seedE2eTestEnv(env: E2eTestEnv): void {
  const seedScript = path.resolve(import.meta.dirname, "../../cli/scripts/seed-test-data.ts");
  execFileSync("bun", ["run", seedScript, env.dbPath, env.contentStorageRoot], {
    stdio: "inherit",
  });
}

export function readE2eTestEnv(): E2eTestEnv {
  const envId = getCurrentEnvId();
  if (cachedEnv && cachedEnvId === envId) return cachedEnv;

  const env = createTestEnv(envId);
  seedE2eTestEnv(env);
  writeE2eAiConfigFile(env);
  cachedEnvId = envId;
  cachedEnv = env;
  return env;
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
  return getE2eProcessEnv(baseEnv);
}

export function getE2eElectronArgs(): string[] {
  const env = readE2eTestEnv();
  return [
    "--reflecta-user-data-dir",
    env.userDataDir,
    "--reflecta-app-config-dir",
    env.appConfigDir,
    "--reflecta-content-root",
    env.contentStorageRoot,
  ];
}

export function hasE2eAiConfig(baseEnv = process.env): boolean {
  return Boolean(getE2eAiEnv(baseEnv).apiKey);
}

export function writeE2eAiConfig(baseEnv = process.env): boolean {
  return writeE2eAiConfigFile(readE2eTestEnv(), baseEnv);
}

function writeE2eAiConfigFile(env: E2eTestEnv, baseEnv = process.env): boolean {
  const { apiKey, providerId, modelId } = getE2eAiEnv(baseEnv);
  if (!apiKey) return false;

  fs.mkdirSync(env.appConfigDir, { recursive: true });
  fs.writeFileSync(
    path.join(env.appConfigDir, "reflecta-config.json"),
    JSON.stringify(
      {
        ai: {
          providers: [{ id: providerId, apiKey, enabledModelIds: [modelId] }],
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
  const run = readE2eTestRun();
  fs.rmSync(run.runRoot, { recursive: true, force: true });
  fs.rmSync(e2eEnvFilePath, { force: true });
  cachedEnvId = undefined;
  cachedEnv = undefined;
}
