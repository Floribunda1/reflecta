import type { EmbeddingProvider } from "./types";

const SEMANTIC_CONCEPTS: RegExp[] = [
  /\b(ai|agent|llm|model)\b|模型|智能体|助手|大模型/i,
  /产出|输出|回复|回答|result|response|answer|output/i,
  /稳定|可靠|可控|一致|预期|quality|stable|reliable|consistent|expected/i,
  /验收|标准|criteria|check|检查|评估|判断|完成/i,
  /搜索|检索|semantic|语义|lexical|关键词|相关/i,
];

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "test-local-concept";

  constructor(private readonly dimensions = 64) {}

  async embed(
    texts: string[],
    options?: { onProgress?: (progress: { completed: number; total: number }) => void },
  ): Promise<number[][]> {
    const vectors = texts.map((text, index) => {
      const vector = this.embedOne(text);
      options?.onProgress?.({ completed: index + 1, total: texts.length });
      return vector;
    });
    return vectors;
  }

  private embedOne(text: string): number[] {
    const vector = Array.from({ length: this.dimensions }, () => 0);

    for (let index = 0; index < SEMANTIC_CONCEPTS.length; index += 1) {
      if (SEMANTIC_CONCEPTS[index].test(text)) {
        vector[index] += 4;
      }
    }

    const length = Math.hypot(...vector) || 1;
    return vector.map((value) => value / length);
  }
}
