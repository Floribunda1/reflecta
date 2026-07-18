export type RetrievalDocumentEntityType = "understanding" | "context";
export type RetrievalChannel = "dense" | "lexical";

export type RetrievalDocument = {
  id: string;
  contentHash: string;
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
  channels: RetrievalChannel[];
};

export type EmbeddingProvider = {
  readonly modelId: string;
  embed(
    texts: string[],
    options?: { onProgress?: (progress: { completed: number; total: number }) => void },
  ): Promise<number[][]>;
};

export type KnowledgeAnchor =
  | { type: "understanding"; id: string }
  | { type: "context"; id: string }
  | { type: "domain"; id: string };

export type RetrieveKnowledgeInput = {
  query: string;
  anchors?: KnowledgeAnchor[];
  limit?: number;
};

export type MatchedContext = {
  contextId: string;
  medium: string;
  title?: string | null;
  snippet: string;
  reason: string;
};

export type CandidateEvidence = {
  channel: "dense" | "lexical" | "relation" | "anchor";
  documentId?: string;
  entityType?: RetrievalDocumentEntityType;
  score?: number;
  rank?: number;
  reason: string;
};

export type UnderstandingCandidate = {
  id: string;
  type: "understanding";
  title?: string | null;
  snippet?: string;
  score: number;
  matchedContexts: MatchedContext[];
  suggestedRead: {
    tool: "understanding_get";
    input: { understandingId: string; includeContexts: true };
  };
  evidence: CandidateEvidence[];
};

export type RetrievalTrace = {
  query: string;
  embeddingModel: string;
  projectionVersion: number;
  dense: { searched: boolean; hits: number };
  lexical: { searched: boolean; hits: number };
  fusion: { method: "rrf"; documentsAfterFusion: number };
  grouping: { understandingCandidates: number; matchedContexts: number };
  relation: { expandedFrom: number; candidates: number };
  returnedCandidates: number;
};

export type RetrieveKnowledgeResult = {
  candidates: UnderstandingCandidate[];
  trace: RetrievalTrace;
};
