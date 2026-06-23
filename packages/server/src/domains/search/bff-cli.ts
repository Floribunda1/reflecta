import { inArray } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { SearchCore } from "./core";
import { toUnderstandingSummaries } from "../understanding/core";
import type { ContextSearchHit } from "../context/types";
import type { UnderstandingSearchHit } from "../understanding/types";
import type { SearchAllResult, SearchOptions } from "./types";

export class SearchCliBff extends SearchCore {
  constructor(db: ReflectaDb) {
    super(db);
  }

  async searchUnderstandings(
    query: string,
    options?: SearchOptions,
  ): Promise<UnderstandingSearchHit[]> {
    const ftsRows = await this.searchUnderstandingIds(query, options);
    if (ftsRows.length === 0) return [];

    const understandingIds = ftsRows.map((r) => r.understandingId);
    const understandingRows = await this.db
      .select()
      .from(understandings)
      .where(inArray(understandings.id, understandingIds));

    const summaries = await toUnderstandingSummaries(this.db, understandingRows);
    const summaryMap = new Map(summaries.map((s) => [s.id, s]));

    return ftsRows
      .map((fts) => {
        const summary = summaryMap.get(fts.understandingId);
        if (!summary) return null;
        return {
          ...summary,
          snippet: fts.snippet,
          rank: fts.rank,
        };
      })
      .filter((h): h is UnderstandingSearchHit => h !== null);
  }

  async searchContexts(query: string, options?: SearchOptions): Promise<ContextSearchHit[]> {
    const rows = await this.searchContextRows(query, options);
    return rows.map((r) => ({
      contextId: r.contextId,
      understandingId: r.understandingId,
      medium: r.medium as ContextSearchHit["medium"],
      title: r.title,
      snippet: r.snippet,
      rank: r.rank,
    }));
  }

  async searchAll(query: string, options?: SearchOptions): Promise<SearchAllResult> {
    const [understandingsResult, contextsResult] = await Promise.all([
      this.searchUnderstandings(query, options),
      this.searchContexts(query, options),
    ]);
    return { understandings: understandingsResult, contexts: contextsResult };
  }
}
