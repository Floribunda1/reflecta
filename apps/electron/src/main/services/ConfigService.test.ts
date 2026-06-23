import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockElectron = vi.hoisted(() => ({
  appData: "",
  userData: "",
}));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return false;
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
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (plainText: string) => Buffer.from(plainText),
    decryptString: (encrypted: Buffer) => encrypted.toString("utf-8"),
  },
}));

vi.mock("electron-ipc-decorator", () => ({
  IpcMethod: () => () => undefined,
  IpcService: class {},
}));

let tempDir: string;
const originalAppConfigDir = process.env.REFLECTA_APP_CONFIG_DIR;
const originalContentStorageRoot = process.env.REFLECTA_CONTENT_STORAGE_ROOT;
const originalIndexPath = process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
const originalProfile = process.env.REFLECTA_PROFILE;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-config-service-"));
  mockElectron.appData = path.join(tempDir, "app-data");
  mockElectron.userData = path.join(tempDir, "user-data");
  process.env.REFLECTA_APP_CONFIG_DIR = path.join(tempDir, "config");
  process.env.REFLECTA_CONTENT_STORAGE_ROOT = path.join(tempDir, "content");
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH = path.join(tempDir, "index");
  process.env.REFLECTA_PROFILE = "prod";
  vi.resetModules();
});

afterEach(async () => {
  const { configureRetrievalEmbedding } = await import("@reflecta/server");
  configureRetrievalEmbedding();
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalAppConfigDir === undefined) delete process.env.REFLECTA_APP_CONFIG_DIR;
  else process.env.REFLECTA_APP_CONFIG_DIR = originalAppConfigDir;
  if (originalContentStorageRoot === undefined) delete process.env.REFLECTA_CONTENT_STORAGE_ROOT;
  else process.env.REFLECTA_CONTENT_STORAGE_ROOT = originalContentStorageRoot;
  if (originalIndexPath === undefined) delete process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
  else process.env.REFLECTA_RETRIEVAL_INDEX_PATH = originalIndexPath;
  if (originalProfile === undefined) delete process.env.REFLECTA_PROFILE;
  else process.env.REFLECTA_PROFILE = originalProfile;
});

describe("ConfigService retrieval index", () => {
  test("returns error status instead of rejecting when embedding endpoint is unavailable", async () => {
    const { UnderstandingCliBff } = await import("@reflecta/server");
    const { initializeDB, getDBInstance } = await import("../db");
    const { ConfigService } = await import("./ConfigService");

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
