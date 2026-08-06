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

export type RetrievalMatchChannel = "dense" | "lexical" | "relation" | "anchor";

/**
 * 候选的单一命中记录（A1：合并原 matchedContexts + evidence）。
 * 一条命中 = 一个实体被一路或多路渠道命中；检索命中带 snippet，关系补充无 snippet。
 */
export type CandidateMatch = {
  /** 判断命中还是材料命中 */
  entityType: RetrievalDocumentEntityType;
  /** 实体 id（Understanding 或 Context 的稳定 id） */
  id: string;
  /** 材料来源（理解命中时为空串） */
  medium: string;
  /** 命中的实体标题（Context 的 title；理解命中时为空） */
  title?: string | null;
  /** 命中原文片段（检索命中） */
  snippet: string;
  /** 命中的渠道（同一实体多路命中合并） */
  channels: RetrievalMatchChannel[];
  /** 该实体的最佳名次 */
  rank: number;
  reason: string;
};

export type UnderstandingCandidate = {
  id: string;
  type: "understanding";
  title?: string | null;
  snippet?: string;
  score: number;
  /** 单一命中列表（A1：替代 matchedContexts + evidence） */
  matches: CandidateMatch[];
  suggestedRead: {
    tool: "understanding_get";
    input: { understandingId: string; includeContexts: true };
  };
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
  /** 相关性信号（Agent 弃权判断依据） */
  returnedCandidates: number;
};

export type RetrieveKnowledgeResult = {
  candidates: UnderstandingCandidate[];
  trace: RetrievalTrace;
};
