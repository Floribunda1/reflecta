import { and, inArray, isNull, or } from "drizzle-orm";
import { understandingConnections, understandingDomains, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { SearchOptions } from "./types";
import { toUnderstandingSummaries } from "../understanding/core";
import {
  RETRIEVAL_PROJECTION_VERSION,
  buildUnderstandingCandidates,
  buildRetrievalDocumentsFromDb,
  createRetrievalIndex,
  getDirtyRetrievalUnderstandingIds,
  getRetrievalEmbeddingModelId,
  isDenseRetrievalEnabled,
  isRetrievalIndexFullyDirty,
} from "../retrieval";
import type {
  RetrievalDocument,
  RetrievalSearchHit,
  RetrieveKnowledgeInput,
  RetrieveKnowledgeResult,
  UnderstandingCandidate,
} from "../retrieval";

export function getLimitOffset(options?: SearchOptions) {
  return {
    limit: options?.limit ?? 20,
    offset: options?.offset ?? 0,
  };
}

type SearchRetrievalHit = RetrievalSearchHit & { rank: number; snippet: string };
type RetrievalSearchMode = "adaptive" | "hybrid" | "lexical";

const RETRIEVE_KNOWLEDGE_DOCUMENT_OVERFETCH_FACTOR = 3;

function lexicalTokens(query: string): string[] {
  return query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function lexicalMatchCount(text: string, tokens: string[]): number {
  const normalized = text.toLocaleLowerCase();
  return tokens.filter((token) => normalized.includes(token)).length;
}

export class SearchCore {
  constructor(protected db: ReflectaDb) {}

  protected async searchRetrievalDocuments(
    query: string,
    options?: SearchOptions,
    mode: RetrievalSearchMode = "adaptive",
  ): Promise<SearchRetrievalHit[]> {
    const { limit, offset } = getLimitOffset(options);
    const index = createRetrievalIndex();
    const resultLimit = limit + offset;
    const indexReady = await index.isReady();
    const fullyDirty = await isRetrievalIndexFullyDirty();
    const dirtyUnderstandingIds = await getDirtyRetrievalUnderstandingIds();
    const dirtyUnderstandingIdSet = new Set(dirtyUnderstandingIds);
    const currentLexicalHits = await this.searchCurrentLexicalDocuments(
      query,
      indexReady && !fullyDirty ? dirtyUnderstandingIds : undefined,
      resultLimit,
    );
    const indexMode =
      mode === "adaptive" && dirtyUnderstandingIds.length > 0 && currentLexicalHits.length > 0
        ? "lexical"
        : mode;
    const indexedHits =
      indexReady && !fullyDirty
        ? indexMode === "lexical"
          ? await index.searchLexical(query, resultLimit)
          : await index.search(query, resultLimit)
        : [];
    const hits = this.mergeCurrentAndIndexedHits(
      currentLexicalHits,
      indexedHits.filter((hit) => !dirtyUnderstandingIdSet.has(hit.parentUnderstandingId)),
      resultLimit,
    );

    return hits.slice(offset).map((hit, index) => ({
      ...hit,
      rank: index + offset,
      snippet: hit.textForLexicalSearch.slice(0, 160),
    }));
  }

  private async searchCurrentLexicalDocuments(
    query: string,
    understandingIds: string[] | undefined,
    limit: number,
  ): Promise<RetrievalSearchHit[]> {
    if (understandingIds !== undefined && understandingIds.length === 0) return [];
    const tokens = lexicalTokens(query);
    if (tokens.length === 0) return [];
    const docs = await buildRetrievalDocumentsFromDb(this.db, understandingIds);
    return docs
      .map((doc) => ({ doc, matchCount: lexicalMatchCount(doc.textForLexicalSearch, tokens) }))
      .filter(({ matchCount }) => matchCount > 0)
      .sort((left, right) => right.matchCount - left.matchCount)
      .slice(0, limit)
      .map(({ doc, matchCount }) => this.toLexicalRetrievalHit(doc, matchCount / tokens.length));
  }

  private toLexicalRetrievalHit(doc: RetrievalDocument, score: number): RetrievalSearchHit {
    return {
      ...doc,
      score,
      channels: ["lexical"],
    };
  }

  private mergeCurrentAndIndexedHits(
    currentHits: RetrievalSearchHit[],
    indexedHits: RetrievalSearchHit[],
    limit: number,
  ): RetrievalSearchHit[] {
    const byId = new Map<string, RetrievalSearchHit>();
    for (const hit of [...currentHits, ...indexedHits]) {
      if (!byId.has(hit.id)) byId.set(hit.id, hit);
    }
    return [...byId.values()].slice(0, limit);
  }

  async searchUnderstandingIds(
    query: string,
    options?: SearchOptions,
  ): Promise<Array<{ understandingId: string; snippet: string; rank: number }>> {
    const hits = await this.searchRetrievalDocuments(query, options, "lexical");
    return hits
      .filter((hit) => hit.entityType === "understanding")
      .map((hit) => ({
        understandingId: hit.entityId,
        snippet: hit.snippet,
        rank: hit.rank,
      }));
  }

  async searchContextRows(
    query: string,
    options?: SearchOptions,
  ): Promise<
    Array<{
      contextId: string;
      understandingId: string;
      medium: string;
      title: string | null;
      snippet: string;
      rank: number;
    }>
  > {
    const hits = await this.searchRetrievalDocuments(query, options, "lexical");
    return hits
      .filter((hit) => hit.entityType === "context")
      .map((hit) => ({
        contextId: hit.entityId,
        understandingId: hit.parentUnderstandingId,
        medium: hit.metadata.medium ?? "",
        title: hit.metadata.title ?? null,
        snippet: hit.snippet,
        rank: hit.rank,
      }));
  }

  async retrieveKnowledge(input: RetrieveKnowledgeInput): Promise<RetrieveKnowledgeResult> {
    const limit = input.limit ?? 10;
    const retrievalDocumentLimit = Math.max(
      limit * RETRIEVE_KNOWLEDGE_DOCUMENT_OVERFETCH_FACTOR,
      limit + 5,
    );
    const hits = await this.searchRetrievalDocuments(
      input.query,
      { limit: retrievalDocumentLimit },
      "hybrid",
    );
    const parentIds = [...new Set(hits.map((hit) => hit.parentUnderstandingId))];
    const rows =
      parentIds.length === 0
        ? []
        : await this.db
            .select()
            .from(understandings)
            .where(and(inArray(understandings.id, parentIds), isNull(understandings.deletedAt)));
    const candidates = buildUnderstandingCandidates({
      hits,
      understandings: await toUnderstandingSummaries(this.db, rows),
    });
    const relationCandidates = await this.expandRelationCandidates(
      candidates,
      input.anchors
        ?.filter((anchor) => anchor.type === "understanding")
        .map((anchor) => anchor.id) ?? [],
      input.anchors?.filter((anchor) => anchor.type === "domain").map((anchor) => anchor.id) ?? [],
      limit,
    );
    const returnedCandidates = [...candidates, ...relationCandidates].slice(0, limit);
    const denseHits = hits.filter((hit) => hit.channels.includes("dense")).length;
    const lexicalHits = hits.filter((hit) => hit.channels.includes("lexical")).length;
    const matchedContexts = returnedCandidates.reduce(
      (count, candidate) => count + candidate.matchedContexts.length,
      0,
    );

    return {
      candidates: returnedCandidates,
      trace: {
        query: input.query,
        embeddingModel: getRetrievalEmbeddingModelId(),
        projectionVersion: RETRIEVAL_PROJECTION_VERSION,
        dense: { searched: isDenseRetrievalEnabled(), hits: denseHits },
        lexical: { searched: true, hits: lexicalHits },
        fusion: { method: "rrf", documentsAfterFusion: hits.length },
        grouping: {
          understandingCandidates: candidates.length,
          matchedContexts,
        },
        relation: {
          expandedFrom: new Set([
            ...candidates.map((candidate) => candidate.id),
            ...(input.anchors
              ?.filter((anchor) => anchor.type === "understanding")
              .map((anchor) => anchor.id) ?? []),
            ...(input.anchors
              ?.filter((anchor) => anchor.type === "domain")
              .map((anchor) => anchor.id) ?? []),
          ]).size,
          candidates: relationCandidates.length,
        },
        returnedCandidates: returnedCandidates.length,
      },
    };
  }

  private async expandRelationCandidates(
    candidates: UnderstandingCandidate[],
    anchorUnderstandingIds: string[],
    anchorDomainIds: string[],
    limit: number,
  ): Promise<UnderstandingCandidate[]> {
    const existingIds = new Set(candidates.map((candidate) => candidate.id));
    const seedIds = [...new Set([...existingIds, ...anchorUnderstandingIds])];
    if (seedIds.length === 0 && anchorDomainIds.length === 0) return [];
    if (existingIds.size >= limit) return [];

    const connectionRows =
      seedIds.length === 0
        ? []
        : await this.db
            .select()
            .from(understandingConnections)
            .where(
              or(
                inArray(understandingConnections.sourceId, seedIds),
                inArray(understandingConnections.targetId, seedIds),
              ),
            );
    const domainRows =
      anchorDomainIds.length === 0
        ? []
        : await this.db
            .select({ understandingId: understandingDomains.understandingId })
            .from(understandingDomains)
            .where(inArray(understandingDomains.domainId, anchorDomainIds));
    const relatedIds = [
      ...new Set(
        [
          ...connectionRows.flatMap((connection) => [connection.sourceId, connection.targetId]),
          ...domainRows.map((row) => row.understandingId),
        ].filter((id) => !existingIds.has(id) && !seedIds.includes(id)),
      ),
    ].slice(0, Math.max(0, limit - existingIds.size));
    if (relatedIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(understandings)
      .where(and(inArray(understandings.id, relatedIds), isNull(understandings.deletedAt)));
    const summaries = await toUnderstandingSummaries(this.db, rows);
    const domainAnchorUnderstandingIds = new Set(domainRows.map((row) => row.understandingId));
    return summaries.map((summary, index) => ({
      id: summary.id,
      type: "understanding" as const,
      title: summary.title,
      snippet: summary.body.slice(0, 160),
      score: 0,
      matchedContexts: [],
      suggestedRead: {
        tool: "understanding_get" as const,
        input: { understandingId: summary.id, includeContexts: true },
      },
      evidence: [
        {
          channel: domainAnchorUnderstandingIds.has(summary.id) ? "anchor" : "relation",
          entityType: "understanding" as const,
          rank: candidates.length + index,
          reason: domainAnchorUnderstandingIds.has(summary.id)
            ? "direct Understanding from Domain anchor"
            : "one-hop explicit Understanding relation",
        },
      ],
    }));
  }
}
