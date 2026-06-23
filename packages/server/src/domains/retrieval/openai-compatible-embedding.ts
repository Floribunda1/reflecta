import type { EmbeddingProvider } from "./types";

type OpenAiCompatibleEmbeddingOptions = {
  baseUrl: string;
  modelId: string;
  apiKey?: string;
};

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
};

export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;
  private readonly endpoint: string;

  constructor(private readonly options: OpenAiCompatibleEmbeddingOptions) {
    this.modelId = options.modelId;
    this.endpoint = `${options.baseUrl.replace(/\/+$/, "")}/embeddings`;
  }

  async embed(texts: string[]): Promise<number[][]> {
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
