import type { EmbeddingProvider } from "./types";

export type RetrievalEmbeddingProviderId = "disabled" | "local-llama-cpp" | "openai-compatible";

export type RetrievalEmbeddingConfig = {
  provider: RetrievalEmbeddingProviderId;
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
  modelPath?: string;
  dimensions?: number;
};

export const LEXICAL_ONLY_EMBEDDING_MODEL = "lexical-only";

const DEFAULT_CONFIG: RetrievalEmbeddingConfig = {
  provider: "disabled",
  modelId: LEXICAL_ONLY_EMBEDDING_MODEL,
  dimensions: 1,
};

let currentConfig = DEFAULT_CONFIG;

function sanitizeModelId(modelId: string) {
  return modelId.trim() || LEXICAL_ONLY_EMBEDDING_MODEL;
}

export function configureRetrievalEmbedding(config?: Partial<RetrievalEmbeddingConfig>): void {
  if (!config || config.provider === "disabled") {
    currentConfig = DEFAULT_CONFIG;
    return;
  }

  currentConfig =
    config.provider === "local-llama-cpp"
      ? {
          provider: "local-llama-cpp",
          modelId: sanitizeModelId(config.modelId ?? ""),
          modelPath: config.modelPath?.trim(),
          dimensions: config.dimensions,
        }
      : {
          provider: "openai-compatible",
          modelId: sanitizeModelId(config.modelId ?? ""),
          baseUrl: config.baseUrl?.trim(),
          apiKey: config.apiKey?.trim(),
          dimensions: config.dimensions,
        };
}

export function getRetrievalEmbeddingConfig(): RetrievalEmbeddingConfig {
  return currentConfig;
}

export function getRetrievalEmbeddingModelId(): string {
  return currentConfig.modelId;
}

export function isDenseRetrievalEnabled(): boolean {
  return currentConfig.provider !== "disabled";
}

export class DisabledEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = LEXICAL_ONLY_EMBEDDING_MODEL;

  async embed(
    texts: string[],
    options?: { onProgress?: (progress: { completed: number; total: number }) => void },
  ): Promise<number[][]> {
    const vectors = texts.map(() => [0]);
    options?.onProgress?.({ completed: vectors.length, total: texts.length });
    return vectors;
  }
}
