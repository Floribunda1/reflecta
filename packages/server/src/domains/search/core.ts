import { Effect } from "effect";
import { and, inArray, isNull, or } from "drizzle-orm";
import { understandingMentions, understandingDomains, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { SearchOptions } from "./types";
import { toUnderstandingSummaries } from "../understanding/core";
import {
  RETRIEVAL_PROJECTION_VERSION,
  buildUnderstandingCandidates,
  createRetrievalIndex,
  getRetrievalEmbeddingModelId,
  isDenseRetrievalEnabled,
} from "../retrieval";
import type {
  RetrievalSearchHit,
  RetrieveKnowledgeInput,
  RetrieveKnowledgeResult,
  UnderstandingCandidate,
} from "../retrieval";

export const RETRIEVAL_SNIPPET_MAX_CHARS = 240;

export function buildSnippet(text: string, maxChars = RETRIEVAL_SNIPPET_MAX_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const cut = trimmed.slice(0, maxChars);
  const boundary = Math.max(
    cut.lastIndexOf("。"),
    cut.lastIndexOf("！"),
    cut.lastIndexOf("？"),
    cut.lastIndexOf("."),
    cut.lastIndexOf("!"),
    cut.lastIndexOf("?"),
    cut.lastIndexOf("\n"),
  );
  if (boundary > maxChars * 0.5) return trimmed.slice(0, boundary + 1);
  return `${trimmed.slice(0, maxChars)}…`;
}

export function getLimitOffset(options?: SearchOptions) {
  return {
    limit: options?.limit ?? 20,
    offset: options?.offset ?? 0,
  };
}

type SearchRetrievalHit = RetrievalSearchHit & { rank: number; snippet: string };
type RetrievalSearchMode = "hybrid" | "lexical";

const RETRIEVE_KNOWLEDGE_DOCUMENT_OVERFETCH_FACTOR = 3;

export class SearchCore {
  constructor(protected db: ReflectaDb) {}

  protected searchRetrievalDocuments(
    query: string,
    options?: SearchOptions,
    mode: RetrievalSearchMode = "hybrid",
  ): Effect.Effect<SearchRetrievalHit[]> {
    return Effect.promise(async () => {
      const { limit, offset } = getLimitOffset(options);
      const index = createRetrievalIndex();
      const resultLimit = limit + offset;
      const hits =
        mode === "lexical"
          ? await index.searchLexical(query, resultLimit)
          : await index.search(query, resultLimit);

      return hits.slice(offset).map((hit, index) => ({
        ...hit,
        rank: index + offset,
        snippet: buildSnippet(hit.textForLexicalSearch),
      }));
    });
  }

  searchUnderstandingIds(
    query: string,
    options?: SearchOptions,
  ): Effect.Effect<Array<{ understandingId: string; snippet: string; rank: number }>> {
    const searchRetrievalDocuments = this.searchRetrievalDocuments.bind(this);
    return Effect.gen(function* () {
      const hits = yield* searchRetrievalDocuments(query, options, "lexical");
      return hits
        .filter((hit) => hit.entityType === "understanding")
        .map((hit) => ({
          understandingId: hit.entityId,
          snippet: hit.snippet,
          rank: hit.rank,
        }));
    });
  }

  searchContextRows(
    query: string,
    options?: SearchOptions,
  ): Effect.Effect<
    Array<{
      contextId: string;
      understandingId: string;
      medium: string;
      title: string | null;
      snippet: string;
      rank: number;
    }>
  > {
    const searchRetrievalDocuments = this.searchRetrievalDocuments.bind(this);
    return Effect.gen(function* () {
      const hits = yield* searchRetrievalDocuments(query, options, "lexical");
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
    });
  }

  retrieveKnowledge(input: RetrieveKnowledgeInput): Effect.Effect<RetrieveKnowledgeResult> {
    const searchRetrievalDocuments = this.searchRetrievalDocuments.bind(this);
    const db = this.db;
    const expandRelationCandidates = this.expandRelationCandidates.bind(this);
    return Effect.gen(function* () {
      const limit = input.limit ?? 10;
      const retrievalDocumentLimit = Math.max(
        limit * RETRIEVE_KNOWLEDGE_DOCUMENT_OVERFETCH_FACTOR,
        limit + 5,
      );
      const hits = yield* searchRetrievalDocuments(
        input.query,
        { limit: retrievalDocumentLimit },
        "hybrid",
      );

      const parentIds = [...new Set(hits.map((hit) => hit.parentUnderstandingId))];
      const rows = yield* Effect.promise(() =>
        parentIds.length === 0
          ? Promise.resolve([])
          : db
              .select()
              .from(understandings)
              .where(and(inArray(understandings.id, parentIds), isNull(understandings.deletedAt))),
      );
      const candidates = buildUnderstandingCandidates({
        hits,
        understandings: yield* Effect.promise(() => toUnderstandingSummaries(db, rows)),
      });
      const relationCandidates = yield* expandRelationCandidates(
        candidates,
        input.anchors
          ?.filter((anchor) => anchor.type === "understanding")
          .map((anchor) => anchor.id) ?? [],
        input.anchors?.filter((anchor) => anchor.type === "domain").map((anchor) => anchor.id) ??
          [],
        limit,
      );
      const returnedCandidates = [...candidates, ...relationCandidates].slice(0, limit);
      const denseHits = hits.filter((hit) => hit.channels.includes("dense")).length;
      const lexicalHits = hits.filter((hit) => hit.channels.includes("lexical")).length;
      const matchedContexts = returnedCandidates.reduce(
        (count, candidate) =>
          count + candidate.matches.filter((match) => match.entityType === "context").length,
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
    });
  }

  private expandRelationCandidates(
    candidates: UnderstandingCandidate[],
    anchorUnderstandingIds: string[],
    anchorDomainIds: string[],
    limit: number,
  ): Effect.Effect<UnderstandingCandidate[]> {
    const db = this.db;
    return Effect.gen(function* () {
      const existingIds = new Set(candidates.map((candidate) => candidate.id));
      const seedIds = [...new Set([...existingIds, ...anchorUnderstandingIds])];
      if (seedIds.length === 0 && anchorDomainIds.length === 0) return [];
      if (existingIds.size >= limit) return [];

      const mentionRows = yield* Effect.promise(() =>
        seedIds.length === 0
          ? Promise.resolve([])
          : db
              .select()
              .from(understandingMentions)
              .where(
                or(
                  inArray(understandingMentions.sourceId, seedIds),
                  inArray(understandingMentions.targetId, seedIds),
                ),
              ),
      );
      const domainRows = yield* Effect.promise(() =>
        anchorDomainIds.length === 0
          ? Promise.resolve([])
          : db
              .select({ understandingId: understandingDomains.understandingId })
              .from(understandingDomains)
              .where(inArray(understandingDomains.domainId, anchorDomainIds)),
      );
      const relatedIds = [
        ...new Set(
          [
            ...mentionRows.flatMap((mention) => [mention.sourceId, mention.targetId]),
            ...domainRows.map((row) => row.understandingId),
          ].filter((id) => !existingIds.has(id) && !seedIds.includes(id)),
        ),
      ].slice(0, Math.max(0, limit - existingIds.size));
      if (relatedIds.length === 0) return [];

      const rows = yield* Effect.promise(() =>
        db
          .select()
          .from(understandings)
          .where(and(inArray(understandings.id, relatedIds), isNull(understandings.deletedAt))),
      );
      const summaries = yield* Effect.promise(() => toUnderstandingSummaries(db, rows));
      const domainAnchorUnderstandingIds = new Set(domainRows.map((row) => row.understandingId));
      return summaries.map((summary, index) => ({
        id: summary.id,
        type: "understanding" as const,
        title: summary.title,
        snippet: buildSnippet(summary.body),
        score: 0,
        matches: [
          {
            entityType: "understanding" as const,
            id: summary.id,
            medium: "",
            snippet: summary.body.slice(0, 160),
            channels: [domainAnchorUnderstandingIds.has(summary.id) ? "anchor" : "relation"],
            rank: candidates.length + index,
            reason: domainAnchorUnderstandingIds.has(summary.id)
              ? "direct Understanding from Domain anchor"
              : "one-hop explicit Understanding relation",
          },
        ],
        suggestedRead: {
          tool: "understanding_get" as const,
          input: { understandingId: summary.id, includeContexts: true },
        },
      }));
    });
  }
}
