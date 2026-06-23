import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LlamaCppEmbeddingProvider } from "./llama-cpp-embedding";

const llamaMock = vi.hoisted(() => ({
  loadModel: vi.fn(),
  createEmbeddingContext: vi.fn(),
  getEmbeddingFor: vi.fn(),
}));

vi.mock("node-llama-cpp", () => ({
  getLlama: vi.fn(async () => ({ loadModel: llamaMock.loadModel })),
}));

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-llama-cpp-embedding-"));
  llamaMock.getEmbeddingFor.mockImplementation(async (text: string) => ({
    vector: [text.length, 1],
  }));
  llamaMock.createEmbeddingContext.mockResolvedValue({
    getEmbeddingFor: llamaMock.getEmbeddingFor,
  });
  llamaMock.loadModel.mockResolvedValue({
    createEmbeddingContext: llamaMock.createEmbeddingContext,
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await rm(tempDir, { recursive: true, force: true });
});

describe("LlamaCppEmbeddingProvider", () => {
  test("embeds text with the configured GGUF model", async () => {
    const modelPath = join(tempDir, "embedding.gguf");
    await writeFile(modelPath, "stub model");
    const provider = new LlamaCppEmbeddingProvider({
      modelId: "test-local-model",
      modelPath,
    });

    await expect(provider.embed(["alpha", "beta"])).resolves.toEqual([
      [5, 1],
      [4, 1],
    ]);
    expect(llamaMock.loadModel).toHaveBeenCalledWith({ modelPath });
    expect(llamaMock.createEmbeddingContext).toHaveBeenCalledTimes(1);
  });

  test("asks the user to download the model before embedding", async () => {
    const provider = new LlamaCppEmbeddingProvider({
      modelId: "test-local-model",
      modelPath: join(tempDir, "missing.gguf"),
    });

    await expect(provider.embed(["alpha"])).rejects.toThrow("请先下载本地 embedding 模型");
    expect(llamaMock.loadModel).not.toHaveBeenCalled();
  });
});
