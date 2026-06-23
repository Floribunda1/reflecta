export type RetrievalDocumentEntityType = "understanding" | "context";

export type RetrievalDocument = {
  id: string;
  entityType: RetrievalDocumentEntityType;
  entityId: string;
  parentUnderstandingId: string;
  textForEmbedding: string;
  textForLexicalSearch: string;
  metadata: {
    domainIds: string[];
    domainNames: string[];
    medium?: string;
    title?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type RetrievalSearchHit = RetrievalDocument & {
  score: number;
  denseDistance?: number;
};

export type EmbeddingProvider = {
  embed(texts: string[]): Promise<number[][]>;
};
