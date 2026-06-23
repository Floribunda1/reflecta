import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockElectron = vi.hoisted(() => ({
  appData: "",
  userData: "",
  isPackaged: false,
}));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return mockElectron.isPackaged;
    },
    getPath(name: string) {
      if (name === "appData") return mockElectron.appData;
      if (name === "userData") return mockElectron.userData;
      throw new Error(`Unexpected app path: ${name}`);
    },
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string) => Buffer.from(`encrypted:${plainText}`),
    decryptString: (encrypted: Buffer) => encrypted.toString("utf-8").replace(/^encrypted:/, ""),
  },
}));

let tempDir: string;
const originalContentStorageRoot = process.env.REFLECTA_CONTENT_STORAGE_ROOT;
const originalProfile = process.env.REFLECTA_PROFILE;
const originalStubRetrievalModelDownload = process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-electron-config-"));
  mockElectron.appData = path.join(tempDir, "app-data");
  mockElectron.userData = path.join(tempDir, "user-data");
  mockElectron.isPackaged = false;
  delete process.env.REFLECTA_CONTENT_STORAGE_ROOT;
  delete process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD;
  process.env.REFLECTA_PROFILE = "dev";
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalContentStorageRoot === undefined) delete process.env.REFLECTA_CONTENT_STORAGE_ROOT;
  else process.env.REFLECTA_CONTENT_STORAGE_ROOT = originalContentStorageRoot;
  if (originalProfile === undefined) delete process.env.REFLECTA_PROFILE;
  else process.env.REFLECTA_PROFILE = originalProfile;
  if (originalStubRetrievalModelDownload === undefined)
    delete process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD;
  else process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD = originalStubRetrievalModelDownload;
});

describe("Electron retrieval config", () => {
  test("uses the built-in Qwen embedding manifest by default", async () => {
    const config = await import("./config");

    expect(config.getRetrievalConfig()).toEqual({
      embedding: {
        provider: "disabled",
        modelId: "Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0",
        modelPath: path.join(
          config.getAppConfigDir(),
          "models",
          "retrieval",
          "Qwen3-Embedding-0.6B-Q8_0.gguf",
        ),
      },
    });
    expect(config.getRetrievalEmbeddingModelStatus()).toMatchObject({
      downloaded: false,
      manifest: {
        name: "Qwen3 Embedding 0.6B",
        runtime: "llama.cpp",
      },
    });
  });

  test("downloads the default embedding model into app config storage", async () => {
    process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD = "1";
    const config = await import("./config");

    const status = await config.downloadDefaultRetrievalEmbeddingModel();

    expect(status.downloaded).toBe(true);
    expect(status.download.state).toBe("downloaded");
    expect(status.modelPath).toBe(
      path.join(config.getAppConfigDir(), "models", "retrieval", "Qwen3-Embedding-0.6B-Q8_0.gguf"),
    );
    expect(fs.readFileSync(status.modelPath, "utf-8")).toContain("stub retrieval embedding model");
  });

  test("encrypts retrieval endpoint API key on write and decrypts it on read", async () => {
    const config = await import("./config");

    config.writeConfig({
      retrieval: {
        embedding: {
          provider: "openai-compatible",
          modelId: "test-model",
          baseUrl: "http://127.0.0.1:8080/v1",
          apiKey: "retrieval-key",
        },
      },
    });

    const raw = fs.readFileSync(config.getAppConfigFilePath(), "utf-8");
    expect(raw).not.toContain("retrieval-key");
    expect(raw).toContain("safe:v1:");

    vi.resetModules();
    const freshConfig = await import("./config");
    expect(freshConfig.readConfig().retrieval?.embedding.apiKey).toBe("retrieval-key");
  });

  test("migrates the legacy default endpoint to the local llama.cpp runtime", async () => {
    const config = await import("./config");

    expect(
      config.normalizeRetrievalConfig({
        embedding: {
          provider: "openai-compatible",
          modelId: "Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0",
          baseUrl: "http://127.0.0.1:8080/v1",
        },
      }),
    ).toMatchObject({
      embedding: {
        provider: "local-llama-cpp",
        modelPath: path.join(
          config.getAppConfigDir(),
          "models",
          "retrieval",
          "Qwen3-Embedding-0.6B-Q8_0.gguf",
        ),
      },
    });
  });
});

describe("Electron content storage root", () => {
  test("uses REFLECTA_CONTENT_STORAGE_ROOT before config", async () => {
    const config = await import("./config");
    const envRoot = path.join(tempDir, "env-root");
    process.env.REFLECTA_CONTENT_STORAGE_ROOT = envRoot;

    expect(config.getContentStorageRoot()).toBe(envRoot);
  });

  test("uses contentStorageRoot from app config", async () => {
    const config = await import("./config");
    const configuredRoot = path.join(tempDir, "configured-root");
    fs.mkdirSync(config.getAppConfigDir(), { recursive: true });
    fs.writeFileSync(
      config.getAppConfigFilePath(),
      JSON.stringify({ contentStorageRoot: configuredRoot }),
    );

    expect(config.getContentStorageRoot()).toBe(configuredRoot);
  });

  test("falls back to default content storage root", async () => {
    const config = await import("./config");

    expect(config.getContentStorageRoot()).toBe(path.join(mockElectron.appData, "reflecta-dev"));
  });

  test("does not read the old storagePath config key", async () => {
    const config = await import("./config");
    fs.mkdirSync(config.getAppConfigDir(), { recursive: true });
    fs.writeFileSync(
      config.getAppConfigFilePath(),
      JSON.stringify({ storagePath: path.join(tempDir, "legacy-root") }),
    );

    expect(config.getContentStorageRoot()).toBe(path.join(mockElectron.appData, "reflecta-dev"));
  });
});

describe("Electron AI config", () => {
  test("does not read the old single aiProvider config key", async () => {
    const config = await import("./config");
    fs.mkdirSync(config.getAppConfigDir(), { recursive: true });
    fs.writeFileSync(
      config.getAppConfigFilePath(),
      JSON.stringify({
        aiProvider: {
          apiKey: "legacy-key",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o",
        },
      }),
    );

    expect(config.getAiConfig()).toEqual({ providers: [], activeAgentModel: undefined });
  });

  test("falls back to the first configured model when the active selection is stale", async () => {
    const config = await import("./config");

    expect(
      config.normalizeAiConfig({
        providers: [
          {
            id: "openai",
            apiKey: "test-key",
            models: [{ id: "gpt-4o" }],
          },
        ],
        activeAgentModel: { providerId: "missing", modelId: "missing" },
      }).activeAgentModel,
    ).toEqual({ providerId: "openai", modelId: "gpt-4o" });
  });

  test("encrypts API keys on write and decrypts them on read", async () => {
    const config = await import("./config");

    config.writeConfig({
      ai: {
        providers: [
          {
            id: "openai",
            apiKey: "test-key",
            models: [{ id: "gpt-4o" }],
          },
        ],
      },
    });

    const raw = fs.readFileSync(config.getAppConfigFilePath(), "utf-8");
    expect(raw).not.toContain("test-key");
    expect(raw).toContain("safe:v1:");

    vi.resetModules();
    const freshConfig = await import("./config");
    expect(freshConfig.readConfig().ai?.providers[0]?.apiKey).toBe("test-key");
  });

  test("drops providers outside the built-in catalog", async () => {
    const config = await import("./config");

    expect(
      config.normalizeAiConfig({
        providers: [
          {
            id: "provider-legacy",
            apiKey: "test-key",
            models: [{ id: "legacy-model" }],
          },
        ],
      }),
    ).toEqual({ providers: [], activeAgentModel: undefined });
  });

  test("allows Codex subscription provider without an API key", async () => {
    const config = await import("./config");
    const ai = config.normalizeAiConfig({
      providers: [{ id: "openai-codex", apiKey: "", models: [] }],
    });

    expect(ai.activeAgentModel).toEqual({ providerId: "openai-codex", modelId: "gpt-5.5" });
    expect(config.getAiModelOptions(ai)[0]).toMatchObject({
      providerId: "openai-codex",
      modelId: "gpt-5.5",
    });
  });
});
