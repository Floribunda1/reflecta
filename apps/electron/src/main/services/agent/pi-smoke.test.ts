import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { getPiAgentSessionsRoot } from "./pi-session-log";
import { runPiAgentSmoke } from "./pi-smoke";

const envTestLocalPath = path.resolve(import.meta.dirname, "../../../../../../.env.test.local");

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

function readEnvTestLocal(): Record<string, string> {
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

function getPiSmokeAiEnv(baseEnv: Record<string, string | undefined> = process.env): {
  apiKey: string;
  modelId: string;
  providerId: string;
} {
  const env = { ...readEnvTestLocal(), ...baseEnv };
  return {
    apiKey: env.REFLECTA_E2E_AI_API_KEY || "",
    modelId: env.REFLECTA_E2E_AI_MODEL || "deepseek-v4-flash",
    providerId: env.REFLECTA_E2E_AI_PROVIDER || "opencode-go",
  };
}

const aiEnv = getPiSmokeAiEnv();
const testWithRealAi = aiEnv.apiKey ? test : test.skip;

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("Pi Agent smoke path", () => {
  test("resolves Pi sessions under Content Storage Root/Sessions", () => {
    expect(getPiAgentSessionsRoot(path.join("root", "content"))).toBe(
      path.join("root", "content", "Sessions"),
    );
  });

  testWithRealAi(
    "receives assistant text from real Pi SDK and stores the session under Content Storage Root/Sessions",
    async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-pi-smoke-"));
      const contentStorageRoot = path.join(tempDir, "content");
      const sessionsRoot = path.join(contentStorageRoot, "Sessions");

      const result = await runPiAgentSmoke({
        apiKey: aiEnv.apiKey,
        contentStorageRoot,
        modelId: aiEnv.modelId,
        providerId: aiEnv.providerId,
        prompt: "用一句中文回复：Pi Agent smoke path is working.",
      });

      expect(result.assistantText.trim().length).toBeGreaterThan(0);
      expect(result.sessionFile).toBeTruthy();
      expect(path.dirname(result.sessionFile)).toBe(sessionsRoot);
      expect(fs.existsSync(result.sessionFile)).toBe(true);
    },
    120_000,
  );
});
