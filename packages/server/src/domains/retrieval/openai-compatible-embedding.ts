import type { EmbeddingProvider } from "./types";

type OpenAiCompatibleEmbeddingOptions = {
  baseUrl: string;
  modelId: string;
  apiKey?: string;
};

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
};

const EMBEDDING_BATCH_SIZE = 32;

export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;
  private readonly endpoint: string;

  constructor(private readonly options: OpenAiCompatibleEmbeddingOptions) {
    this.modelId = options.modelId;
    this.endpoint = `${options.baseUrl.replace(/\/+$/, "")}/embeddings`;
  }

  async embed(
    texts: string[],
    options?: { onProgress?: (progress: { completed: number; total: number }) => void },
  ): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
      vectors.push(...(await this.embedBatch(texts.slice(index, index + EMBEDDING_BATCH_SIZE))));
      options?.onProgress?.({ completed: vectors.length, total: texts.length });
    }
    return vectors;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.options.modelId,
        input: texts,
        encoding_format: "float",
      }),
    });
    if (!response.ok) {
      throw new Error(`Embedding endpoint failed: ${response.status}`);
    }

    const json = (await response.json()) as EmbeddingResponse;
    const vectors = json.data?.map((item) => item.embedding).filter((item) => item !== undefined);
    if (!vectors || vectors.length !== texts.length) {
      throw new Error("Embedding endpoint returned invalid vectors");
    }
    return vectors;
  }
}
