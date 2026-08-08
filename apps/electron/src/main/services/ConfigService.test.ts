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
    getVersion: () => "1.1.0",
    relaunch: vi.fn(),
    quit: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("electron-ipc-decorator", () => ({
  IpcMethod: () => () => undefined,
  IpcService: class {},
}));

vi.mock("./agent/pi-model-runtime", () => ({
  createPiModelRuntime: vi.fn(async () => ({
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => {
      // Mirror the real ModelRuntime.logout: drop the stored Codex credential.
      const { getPiAuthPath } = await import("../config");
      const fs = await import("node:fs");
      const authPath = getPiAuthPath();
      try {
        const data = JSON.parse(fs.readFileSync(authPath, "utf-8")) as Record<string, unknown>;
        delete data["openai-codex"];
        fs.writeFileSync(authPath, JSON.stringify(data));
      } catch {
        // No stored credential — nothing to remove.
      }
    }),
  })),
  createCodexBrowserAuthInteraction: vi.fn(),
}));

let tempDir: string;
const originalIndexPath = process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
const originalArgv = process.argv;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-config-service-"));
  mockElectron.appData = path.join(tempDir, "app-data");
  mockElectron.userData = path.join(tempDir, "user-data");
  mockElectron.isPackaged = false;
  process.argv = [
    "electron",
    "app",
    "--reflecta-app-config-dir",
    path.join(tempDir, "config"),
    "--reflecta-content-root",
    path.join(tempDir, "content"),
  ];
  delete process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
  vi.resetModules();
});

afterEach(async () => {
  const { configureRetrievalEmbedding } = await import("@reflecta/server");
  configureRetrievalEmbedding();
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalIndexPath === undefined) delete process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
  else process.env.REFLECTA_RETRIEVAL_INDEX_PATH = originalIndexPath;
  process.argv = originalArgv;
});

describe("ConfigService retrieval index", () => {
  test("returns error status instead of rejecting when embedding endpoint is unavailable", async () => {
    const { UnderstandingCliBff, createDBInstance } = await import("@reflecta/server");
    const { initializeDB, getDBInstance } = await import("../db");
    const { ConfigService } = await import("./ConfigService");
    const contentRoot = path.join(tempDir, "content");
    fs.mkdirSync(contentRoot, { recursive: true });
    const seededDb = await createDBInstance(path.join(contentRoot, "reflecta.db"), {
      runMigrations: true,
    });
    seededDb.$client.close();

    await initializeDB();
    const service = new ConfigService();
    await service.setRetrievalConfig({
      embedding: {
        provider: "openai-compatible",
        modelId: "test-embedding",
        baseUrl: "http://127.0.0.1:65535/v1",
      },
    });
    await new UnderstandingCliBff(getDBInstance()).createUnderstanding({
      title: "Endpoint Down",
      body: "This row forces rebuild to request embeddings.",
    });

    await expect(service.rebuildRetrievalIndex()).resolves.toMatchObject({
      state: "error",
      error: expect.stringContaining("fetch failed"),
    });
  }, 15_000);
});

describe("ConfigService AI models", () => {
  test("requires an authenticated provider to enable at least one model", async () => {
    const { ConfigService } = await import("./ConfigService");
    const service = new ConfigService();

    await expect(
      service.setAiConfig({
        providers: [{ id: "openai", apiKey: "test-key", enabledModelIds: [] }],
      }),
    ).rejects.toThrow("请至少选择一个用于 Chat 的模型");
  });

  test("clamps reasoning when switching to a model with fewer levels", async () => {
    const { ConfigService } = await import("./ConfigService");
    const service = new ConfigService();
    await service.setAiConfig({
      providers: [{ id: "openai", apiKey: "test-key", enabledModelIds: ["o3", "gpt-4o"] }],
      activeAgentModel: { providerId: "openai", modelId: "o3" },
      activeAgentReasoningLevel: "high",
    });

    await expect(
      service.setActiveAgentModel({ providerId: "openai", modelId: "gpt-4o" }),
    ).resolves.toBe("off");

    await expect(service.getActiveAgentReasoningLevel()).resolves.toBe("off");
  });

  test("rejects reasoning levels unsupported by the active model", async () => {
    const { ConfigService } = await import("./ConfigService");
    const service = new ConfigService();
    await service.setAiConfig({
      providers: [{ id: "openai", apiKey: "test-key", enabledModelIds: ["gpt-4o"] }],
    });

    await expect(service.setActiveAgentReasoningLevel("high")).rejects.toThrow(
      "当前模型不支持该推理等级",
    );
  });

  test("disconnects Codex and removes its models from the saved configuration", async () => {
    const config = await import("../config");
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
    const { ConfigService } = await import("./ConfigService");
    const service = new ConfigService();
    await service.setAiConfig({
      providers: [{ id: "openai-codex", apiKey: "", enabledModelIds: ["gpt-5.5"] }],
    });

    await service.disconnectCodex();

    await expect(service.getCodexAuthStatus()).resolves.toBe(false);
    await expect(service.getAiConfig()).resolves.toMatchObject({ providers: [] });
  });
});
