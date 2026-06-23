import { and, inArray, isNull, or } from "drizzle-orm";
import { understandingConnections, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { SearchOptions } from "./types";
import { toUnderstandingSummaries } from "../understanding/core";
import {
  buildRetrievalDocumentsFromDb,
  buildUnderstandingCandidates,
  createRetrievalIndex,
} from "../retrieval";
import type {
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

export class SearchCore {
  constructor(protected db: ReflectaDb) {}

  protected async searchRetrievalDocuments(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchRetrievalHit[]> {
    const { limit, offset } = getLimitOffset(options);
    const index = createRetrievalIndex();
    if (!(await index.isReady())) {
      await index.replaceAll(await buildRetrievalDocumentsFromDb(this.db));
    }
    const hits = await index.search(query, limit + offset);
    return hits.slice(offset).map((hit, index) => ({
      ...hit,
      rank: index + offset,
      snippet: hit.textForLexicalSearch.slice(0, 160),
    }));
  }

  async searchUnderstandingIds(
    query: string,
    options?: SearchOptions,
  ): Promise<Array<{ understandingId: string; snippet: string; rank: number }>> {
    const hits = await this.searchRetrievalDocuments(query, options);
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
    const hits = await this.searchRetrievalDocuments(query, options);
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
    const hits = await this.searchRetrievalDocuments(input.query, { limit });
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
        dense: { searched: true, hits: denseHits },
        lexical: { searched: true, hits: lexicalHits },
        fusion: { method: "lancedb", documentsAfterFusion: hits.length },
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
    limit: number,
  ): Promise<UnderstandingCandidate[]> {
    const existingIds = new Set(candidates.map((candidate) => candidate.id));
    const seedIds = [...new Set([...existingIds, ...anchorUnderstandingIds])];
    if (seedIds.length === 0 || existingIds.size >= limit) return [];

    const connectionRows = await this.db
      .select()
      .from(understandingConnections)
      .where(
        or(
          inArray(understandingConnections.sourceId, seedIds),
          inArray(understandingConnections.targetId, seedIds),
        ),
      );
    const relatedIds = [
      ...new Set(
        connectionRows
          .flatMap((connection) => [connection.sourceId, connection.targetId])
          .filter((id) => !existingIds.has(id) && !seedIds.includes(id)),
      ),
    ].slice(0, Math.max(0, limit - existingIds.size));
    if (relatedIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(understandings)
      .where(and(inArray(understandings.id, relatedIds), isNull(understandings.deletedAt)));
    const summaries = await toUnderstandingSummaries(this.db, rows);
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
          channel: "relation" as const,
          entityType: "understanding" as const,
          rank: candidates.length + index,
          reason: "one-hop explicit Understanding relation",
        },
      ],
    }));
  }
}
