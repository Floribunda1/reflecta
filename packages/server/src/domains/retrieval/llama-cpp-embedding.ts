import { existsSync } from "node:fs";
import type { EmbeddingProvider } from "./types";

type LlamaEmbeddingContext = {
  getEmbeddingFor(input: string): Promise<{ vector: readonly number[] }>;
};

type LlamaCppEmbeddingProviderOptions = {
  modelId: string;
  modelPath: string;
};

export class LlamaCppEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;
  private context?: Promise<LlamaEmbeddingContext>;

  constructor(private readonly options: LlamaCppEmbeddingProviderOptions) {
    this.modelId = options.modelId;
  }

  async embed(
    texts: string[],
    options?: { onProgress?: (progress: { completed: number; total: number }) => void },
  ): Promise<number[][]> {
    const context = await this.getContext();
    const vectors: number[][] = [];
    for (const text of texts) {
      vectors.push([...(await context.getEmbeddingFor(text)).vector]);
      options?.onProgress?.({ completed: vectors.length, total: texts.length });
    }
    return vectors;
  }

  private getContext(): Promise<LlamaEmbeddingContext> {
    if (!existsSync(this.options.modelPath)) {
      throw new Error("请先下载本地 embedding 模型");
    }
    this.context ??= this.createContext();
    return this.context;
  }

  private async createContext(): Promise<LlamaEmbeddingContext> {
    const { getLlama } = await import("node-llama-cpp");
    const llama = await getLlama({ progressLogs: false });
    const model = await llama.loadModel({ modelPath: this.options.modelPath });
    return model.createEmbeddingContext();
  }
}
