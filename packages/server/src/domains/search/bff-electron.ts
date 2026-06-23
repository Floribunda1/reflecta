import { inArray } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { FtsContextResult, SearchOptions, SearchResult } from "./types";
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
    const ftsRows = await this.searchUnderstandingIds(query, { limit, offset });
    if (ftsRows.length === 0) return [];

    const understandingIds = ftsRows.map((r) => r.understandingId);
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

  async searchContexts(query: string, options?: SearchOptions): Promise<FtsContextResult[]> {
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
    const [understandingDTOs, ctxResults] = await Promise.all([
      this.searchUnderstandings(query, options),
      this.searchContexts(query, options),
    ]);
    return { understandings: understandingDTOs, contexts: ctxResults };
  }
}
