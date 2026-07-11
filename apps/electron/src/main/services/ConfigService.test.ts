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
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("electron-ipc-decorator", () => ({
  IpcMethod: () => () => undefined,
  IpcService: class {},
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
  });
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

    await service.setActiveAgentModel({ providerId: "openai", modelId: "gpt-4o" });

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
});
