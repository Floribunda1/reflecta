import type { EmbeddingProvider } from "./types";

export type RetrievalEmbeddingProviderId = "disabled" | "openai-compatible";

export type RetrievalEmbeddingConfig = {
  provider: RetrievalEmbeddingProviderId;
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
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

  currentConfig = {
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

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0]);
  }
}
