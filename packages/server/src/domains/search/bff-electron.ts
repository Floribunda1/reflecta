import { inArray } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { SearchContextResult, SearchOptions, SearchResult } from "./types";
import type { UnderstandingSummaryDTO } from "../understanding/types";
import { SearchCore } from "./core";
import { getLimitOffset } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";
import type { UnderstandingElectronBff } from "../understanding/bff-electron";

export class SearchElectronBff extends SearchCore {
  private readonly understandingService: UnderstandingElectronBff;

  constructor(options: ReflectaServerContext & { understandingService: UnderstandingElectronBff }) {
    super(options.getDb());
    this.understandingService = options.understandingService;
  }

  async searchUnderstandings(
    query: string,
    options?: SearchOptions,
  ): Promise<UnderstandingSummaryDTO[]> {
    const { limit, offset } = getLimitOffset(options);
    const retrievalRows = await this.searchUnderstandingIds(query, { limit, offset });
    if (retrievalRows.length === 0) return [];

    const understandingIds = retrievalRows.map((r) => r.understandingId);
    const understandingRows = await this.db
      .select()
      .from(understandings)
      .where(inArray(understandings.id, understandingIds));
    const dtos =
      await this.understandingService.assembleUnderstandingSummaryDTOs(understandingRows);
    const dtoMap = new Map(dtos.map((d) => [d.id, d]));
    return understandingIds
      .map((id) => dtoMap.get(id))
      .filter((d): d is UnderstandingSummaryDTO => d !== undefined);
  }

  async searchContexts(query: string, options?: SearchOptions): Promise<SearchContextResult[]> {
    const { limit, offset } = getLimitOffset(options);
    const rows = await this.searchContextRows(query, { limit, offset });
    return rows.map((r) => ({
      contextId: r.contextId,
      understandingId: r.understandingId,
      title: r.title,
      snippet: r.snippet,
      rank: r.rank,
    }));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const retrievalHits = await this.searchRetrievalDocuments(query, options);
    const understandingIds = [
      ...new Set(
        retrievalHits
          .filter((hit) => hit.entityType === "understanding")
          .map((hit) => hit.entityId),
      ),
    ];
    const understandingRows =
      understandingIds.length === 0
        ? []
        : await this.db
            .select()
            .from(understandings)
            .where(inArray(understandings.id, understandingIds));
    const understandingDTOs =
      await this.understandingService.assembleUnderstandingSummaryDTOs(understandingRows);
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
  }
}
