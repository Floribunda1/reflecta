import { Effect } from "effect";
import { and, desc, inArray, isNull, sql } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { SearchContextResult, SearchOptions, SearchResult } from "./types";
import type { UnderstandingSummaryDTO } from "../understanding/types";
import { SearchCore } from "./core";
import { getLimitOffset } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";
import type { UnderstandingElectronBff } from "../understanding/bff-electron";

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export class SearchElectronBff extends SearchCore {
  private readonly understandingService: UnderstandingElectronBff;

  constructor(options: ReflectaServerContext & { understandingService: UnderstandingElectronBff }) {
    super(options.getDb());
    this.understandingService = options.understandingService;
  }

  searchUnderstandings(
    query: string,
    options?: SearchOptions,
  ): Effect.Effect<UnderstandingSummaryDTO[]> {
    const db = this.db;
    const understandingService = this.understandingService;
    const searchUnderstandingIds = this.searchUnderstandingIds.bind(this);
    return Effect.gen(function* () {
      const { limit, offset } = getLimitOffset(options);
      const candidateLimit = limit + offset;
      const escapedQuery = escapeLike(query.trim());
      const titleRows = yield* Effect.promise(() =>
        db
          .select({ id: understandings.id })
          .from(understandings)
          .where(
            and(
              isNull(understandings.deletedAt),
              sql`lower(${understandings.title}) LIKE lower(${`%${escapedQuery}%`}) ESCAPE '\\'`,
            ),
          )
          .orderBy(
            sql`CASE
              WHEN lower(${understandings.title}) = lower(${escapedQuery}) THEN 0
              WHEN lower(${understandings.title}) LIKE lower(${`${escapedQuery}%`}) ESCAPE '\\' THEN 1
              ELSE 2
            END`,
            desc(understandings.updatedAt),
          )
          .limit(candidateLimit),
      );
      const retrievalRows = yield* searchUnderstandingIds(query, { limit: candidateLimit });

      const understandingIds = [
        ...new Set([
          ...titleRows.map((row) => row.id),
          ...retrievalRows.map((r) => r.understandingId),
        ]),
      ].slice(offset, offset + limit);
      if (understandingIds.length === 0) return [];
      const understandingRows = yield* Effect.promise(() =>
        db.select().from(understandings).where(inArray(understandings.id, understandingIds)),
      );
      const dtos = yield* understandingService.assembleUnderstandingSummaryDTOs(understandingRows);
      const dtoMap = new Map(dtos.map((d) => [d.id, d]));
      return understandingIds
        .map((id) => dtoMap.get(id))
        .filter((d): d is UnderstandingSummaryDTO => d !== undefined);
    });
  }

  searchContexts(query: string, options?: SearchOptions): Effect.Effect<SearchContextResult[]> {
    const searchContextRows = this.searchContextRows.bind(this);
    return Effect.gen(function* () {
      const { limit, offset } = getLimitOffset(options);
      const rows = yield* searchContextRows(query, { limit, offset });
      return rows.map((r) => ({
        contextId: r.contextId,
        understandingId: r.understandingId,
        title: r.title,
        snippet: r.snippet,
        rank: r.rank,
      }));
    });
  }

  search(query: string, options?: SearchOptions): Effect.Effect<SearchResult> {
    const db = this.db;
    const understandingService = this.understandingService;
    const searchRetrievalDocuments = this.searchRetrievalDocuments.bind(this);
    return Effect.gen(function* () {
      const retrievalHits = yield* searchRetrievalDocuments(query, options);
      const understandingIds = [
        ...new Set(
          retrievalHits
            .filter((hit) => hit.entityType === "understanding")
            .map((hit) => hit.entityId),
        ),
      ];
      const understandingRows = yield* Effect.promise(() =>
        understandingIds.length === 0
          ? Promise.resolve([])
          : db.select().from(understandings).where(inArray(understandings.id, understandingIds)),
      );
      const understandingDTOs =
        yield* understandingService.assembleUnderstandingSummaryDTOs(understandingRows);
      const ctxResults = retrievalHits
        .filter((hit) => hit.entityType === "context")
        .map((hit) => ({
          contextId: hit.entityId,
          understandingId: hit.parentUnderstandingId,
          title: hit.metadata.title ?? null,
          snippet: hit.snippet,
          rank: hit.rank,
        }));
      return { understandings: understandingDTOs, contexts: ctxResults };
    });
  }
}
