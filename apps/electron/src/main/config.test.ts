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
}));

let tempDir: string;
const originalContentStorageRoot = process.env.REFLECTA_CONTENT_STORAGE_ROOT;
const originalProfile = process.env.REFLECTA_PROFILE;
const originalStubRetrievalModelDownload = process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD;
const originalArgv = process.argv;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-electron-config-"));
  mockElectron.appData = path.join(tempDir, "app-data");
  mockElectron.userData = path.join(tempDir, "user-data");
  mockElectron.isPackaged = false;
  process.argv = ["electron", "app"];
  delete process.env.REFLECTA_CONTENT_STORAGE_ROOT;
  delete process.env.REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD;
  delete process.env.REFLECTA_PROFILE;
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
  process.argv = originalArgv;
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

  test("stores retrieval endpoint API key as plain config", async () => {
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
    expect(raw).toContain("retrieval-key");

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
  test("uses explicit content root argument before config", async () => {
    const config = await import("./config");
    const explicitRoot = path.join(tempDir, "explicit-root");
    process.argv.push("--reflecta-content-root", explicitRoot);

    expect(config.getContentStorageRoot()).toBe(explicitRoot);
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

  test("keeps retrieval index in app config storage when content root is custom", async () => {
    const config = await import("./config");
    const configuredRoot = path.join(tempDir, "configured-root");
    fs.mkdirSync(config.getAppConfigDir(), { recursive: true });
    fs.writeFileSync(
      config.getAppConfigFilePath(),
      JSON.stringify({ contentStorageRoot: configuredRoot }),
    );

    expect(config.getRetrievalIndexPath()).toBe(
      path.join(config.getAppConfigDir(), "retrieval-index"),
    );
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

  test("does not let Reflecta env override source content storage", async () => {
    const config = await import("./config");
    process.env.REFLECTA_PROFILE = "prod";
    process.env.REFLECTA_CONTENT_STORAGE_ROOT = path.join(tempDir, "env-root");

    expect(config.getReflectaProfile()).toBe("dev");
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

    expect(config.getAiConfig()).toEqual({
      providers: [],
      activeAgentModel: undefined,
      titleGenerationModel: undefined,
    });
  });

  test("falls back to the first configured model when the active selection is stale", async () => {
    const config = await import("./config");

    expect(
      config.normalizeAiConfig({
        providers: [
          {
            id: "openai",
            apiKey: "test-key",
            enabledModelIds: ["gpt-4o"],
          },
        ],
        activeAgentModel: { providerId: "missing", modelId: "missing" },
      }).activeAgentModel,
    ).toEqual({ providerId: "openai", modelId: "gpt-4o" });
  });

  test("migrates known legacy model objects and drops unknown models", async () => {
    const config = await import("./config");
    const legacy = {
      providers: [
        {
          id: "openai",
          apiKey: "test-key",
          models: [{ id: "gpt-4o" }, { id: "unknown-model", name: "Unknown" }],
        },
      ],
    };

    expect(config.normalizeAiConfig(legacy as never).providers).toEqual([
      { id: "openai", apiKey: "test-key", enabledModelIds: ["gpt-4o"] },
    ]);
  });

  test("maps Reflecta provider ids to pi-ai providers", async () => {
    const config = await import("./config");

    expect(config.getAiProviderDefinition("gemini").piProviderId).toBe("google");
    expect(config.getAiProviderDefinition("moonshot").piProviderId).toBe("moonshotai-cn");
    expect(config.getAiProviderDefinition("opencode-zen").piProviderId).toBe("opencode");
    expect(config.getAiProviderDefinitions().map((provider) => provider.id)).not.toContain("qwen");
  });

  test("exposes the latest Codex subscription models and max reasoning", async () => {
    const config = await import("./config");
    const models = config.getAiProviderDefinition("openai-codex").models;

    expect(models.map((model) => model.id)).toEqual(
      expect.arrayContaining(["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]),
    );
    expect(models.find((model) => model.id === "gpt-5.6-sol")?.supportedReasoningLevels).toContain(
      "max",
    );
  });

  test("lists only enabled models with pi-ai names and reasoning levels", async () => {
    const config = await import("./config");
    const ai = config.normalizeAiConfig({
      providers: [{ id: "openai", apiKey: "test-key", enabledModelIds: ["gpt-4o", "o3"] }],
    });

    expect(config.getAiModelOptions(ai)).toEqual([
      expect.objectContaining({
        modelId: "gpt-4o",
        modelName: "GPT-4o",
        supportedReasoningLevels: ["off"],
      }),
      expect.objectContaining({
        modelId: "o3",
        modelName: "o3",
        supportedReasoningLevels: ["low", "medium", "high"],
      }),
    ]);
  });

  test("clamps the configured reasoning level to the active model", async () => {
    const config = await import("./config");
    const ai = config.normalizeAiConfig({
      providers: [{ id: "openai", apiKey: "test-key", enabledModelIds: ["gpt-4o"] }],
      activeAgentReasoningLevel: "high",
    });

    expect(config.getActiveAgentReasoningLevel(ai)).toBe("off");
  });

  test("falls back to the active model when the title generation selection is stale", async () => {
    const config = await import("./config");

    expect(
      config.normalizeAiConfig({
        providers: [
          {
            id: "openai",
            apiKey: "test-key",
            enabledModelIds: ["gpt-4o", "gpt-4o-mini"],
          },
        ],
        activeAgentModel: { providerId: "openai", modelId: "gpt-4o-mini" },
        titleGenerationModel: { providerId: "missing", modelId: "missing" },
      }).titleGenerationModel,
    ).toEqual({ providerId: "openai", modelId: "gpt-4o-mini" });
  });

  test("keeps the selected agent reasoning level", async () => {
    const config = await import("./config");

    expect(
      config.normalizeAiConfig({
        providers: [
          {
            id: "openai",
            apiKey: "test-key",
            enabledModelIds: ["gpt-4o"],
          },
        ],
        activeAgentReasoningLevel: "high",
      }).activeAgentReasoningLevel,
    ).toBe("high");
  });

  test("stores AI API keys as plain config", async () => {
    const config = await import("./config");

    config.writeConfig({
      ai: {
        providers: [
          {
            id: "openai",
            apiKey: "test-key",
            enabledModelIds: ["gpt-4o"],
          },
        ],
      },
    });

    const raw = fs.readFileSync(config.getAppConfigFilePath(), "utf-8");
    expect(raw).toContain("test-key");

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
            enabledModelIds: ["legacy-model"],
          },
        ],
      }),
    ).toEqual({
      providers: [],
      activeAgentModel: undefined,
      titleGenerationModel: undefined,
    });
  });

  test("only enables Codex subscription models after Reflecta OAuth succeeds", async () => {
    const config = await import("./config");
    const input = {
      providers: [{ id: "openai-codex", apiKey: "", enabledModelIds: ["gpt-5.5"] }],
    };

    expect(config.normalizeAiConfig(input).activeAgentModel).toBeUndefined();

    fs.mkdirSync(path.dirname(config.getPiAuthPath()), { recursive: true });
    fs.writeFileSync(
      config.getPiAuthPath(),
      JSON.stringify({
        "openai-codex": {
          type: "oauth",
          access: "codex-access-token",
          refresh: "codex-refresh-token",
          expires: 4_102_444_800_000,
          accountId: "account-test",
        },
      }),
    );
    const ai = config.normalizeAiConfig(input);

    expect(ai.activeAgentModel).toEqual({ providerId: "openai-codex", modelId: "gpt-5.5" });
    expect(ai.titleGenerationModel).toEqual({ providerId: "openai-codex", modelId: "gpt-5.5" });
    expect(config.getAiModelOptions(ai)[0]).toMatchObject({
      providerId: "openai-codex",
      modelId: "gpt-5.5",
    });
  });
});
