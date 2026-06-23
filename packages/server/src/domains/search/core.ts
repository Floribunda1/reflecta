import { and, desc, inArray, isNull } from "drizzle-orm";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { contexts, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { SearchOptions } from "./types";
import { resolveDomainRefs } from "../domain/core";
import { toUnderstandingSummaries } from "../understanding/core";
import {
  LanceDbRetrievalIndex,
  LocalEmbeddingProvider,
  buildUnderstandingCandidates,
  buildRetrievalDocuments,
} from "../retrieval";
import type {
  RetrievalSearchHit,
  RetrieveKnowledgeInput,
  RetrieveKnowledgeResult,
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
    const docs = await this.buildRetrievalDocuments();
    if (docs.length === 0) return [];

    const index = new LanceDbRetrievalIndex({
      uri:
        process.env.REFLECTA_RETRIEVAL_INDEX_PATH ??
        join(tmpdir(), "reflecta-retrieval-index", String(process.pid)),
      embeddingProvider: new LocalEmbeddingProvider(),
    });
    // ponytail: rebuild-on-search; replace with write-path sync before large profiles.
    await index.replaceAll(docs);
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
    const denseHits = hits.filter((hit) => hit.denseDistance !== undefined).length;
    const matchedContexts = candidates.reduce(
      (count, candidate) => count + candidate.matchedContexts.length,
      0,
    );

    return {
      candidates,
      trace: {
        query: input.query,
        dense: { searched: true, hits: denseHits },
        lexical: { searched: true, hits: hits.length - denseHits },
        fusion: { method: "lancedb", documentsAfterFusion: hits.length },
        grouping: {
          understandingCandidates: candidates.length,
          matchedContexts,
        },
        returnedCandidates: candidates.length,
      },
    };
  }

  private async buildRetrievalDocuments() {
    const understandingRows = await this.db
      .select()
      .from(understandings)
      .where(isNull(understandings.deletedAt))
      .orderBy(desc(understandings.updatedAt));
    if (understandingRows.length === 0) return [];

    const understandingIds = understandingRows.map((understanding) => understanding.id);
    const [domainRefs, contextRows] = await Promise.all([
      resolveDomainRefs(this.db, understandingIds),
      this.db
        .select()
        .from(contexts)
        .where(
          and(inArray(contexts.understandingId, understandingIds), isNull(contexts.deletedAt)),
        ),
    ]);
    const contextsByUnderstandingId = new Map<string, typeof contextRows>();
    for (const context of contextRows) {
      const items = contextsByUnderstandingId.get(context.understandingId) ?? [];
      items.push(context);
      contextsByUnderstandingId.set(context.understandingId, items);
    }

    return understandingRows.flatMap((understanding) =>
      buildRetrievalDocuments({
        understanding,
        domains: domainRefs.get(understanding.id) ?? [],
        contexts: (contextsByUnderstandingId.get(understanding.id) ?? []).map((context) => ({
          id: context.id,
          medium: context.medium,
          title: context.title,
          content: context.content,
          createdAt: context.createdAt,
        })),
      }),
    );
  }
}
