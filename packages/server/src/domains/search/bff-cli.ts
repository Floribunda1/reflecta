import { inArray } from "drizzle-orm";
import { thoughts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { SearchCore } from "./core";
import { toThoughtSummaries } from "../thought/core";
import type { ContextSearchHit } from "../context/types";
import type { ThoughtSearchHit } from "../thought/types";
import type { SearchAllResult, SearchOptions } from "./types";

export class SearchCliBff extends SearchCore {
  constructor(db: ReflectaDb) {
    super(db);
  }

  async searchThoughts(query: string, options?: SearchOptions): Promise<ThoughtSearchHit[]> {
    const ftsRows = await this.searchThoughtIds(query, options);
    if (ftsRows.length === 0) return [];

    const thoughtIds = ftsRows.map((r) => r.thoughtId);
    const thoughtRows = await this.db
      .select()
      .from(thoughts)
      .where(inArray(thoughts.id, thoughtIds));

    const summaries = await toThoughtSummaries(this.db, thoughtRows);
    const summaryMap = new Map(summaries.map((s) => [s.id, s]));

    return ftsRows
      .map((fts) => {
        const summary = summaryMap.get(fts.thoughtId);
        if (!summary) return null;
        return {
          ...summary,
          snippet: fts.snippet,
          rank: fts.rank,
        };
      })
      .filter((h): h is ThoughtSearchHit => h !== null);
  }

  async searchContexts(query: string, options?: SearchOptions): Promise<ContextSearchHit[]> {
    const rows = await this.searchContextRows(query, options);
    return rows.map((r) => ({
      contextId: r.contextId,
      thoughtId: r.thoughtId,
      sourceType: r.sourceType as ContextSearchHit["sourceType"],
      sourceName: r.sourceName,
      snippet: r.snippet,
      rank: r.rank,
    }));
  }

  async searchAll(query: string, options?: SearchOptions): Promise<SearchAllResult> {
    const [thoughtsResult, contextsResult] = await Promise.all([
      this.searchThoughts(query, options),
      this.searchContexts(query, options),
    ]);
    return { thoughts: thoughtsResult, contexts: contextsResult };
  }
}
