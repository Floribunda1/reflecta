import { inArray, sql } from "drizzle-orm";
import { thoughts } from "../../db/schema";
import type { ReflectaDb } from "../electron/types";
import { toThoughtSummaries } from "./shared";
import type { ContextSearchHit, SearchAllResult, SearchOptions, ThoughtSearchHit } from "./types";

export class SearchService {
  constructor(private db: ReflectaDb) {}

  async searchThoughts(query: string, options?: SearchOptions): Promise<ThoughtSearchHit[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const escaped = `"${query.replace(/"/g, '""')}"`;

    const ftsRows = await this.db.all<{
      thought_id: string;
      snippet: string;
      rank: number;
    }>(sql`
      SELECT
        thought_id,
        snippet(fts_thoughts, 1, '<mark>', '</mark>', '…', 10) AS snippet,
        rank
      FROM fts_thoughts
      WHERE fts_thoughts MATCH ${escaped}
      ORDER BY rank
      LIMIT ${limit} OFFSET ${offset}
    `);

    if (ftsRows.length === 0) return [];

    const thoughtIds = ftsRows.map((r) => r.thought_id);
    const thoughtRows = await this.db
      .select()
      .from(thoughts)
      .where(inArray(thoughts.id, thoughtIds));

    const summaries = await toThoughtSummaries(this.db, thoughtRows);
    const summaryMap = new Map(summaries.map((s) => [s.id, s]));

    return ftsRows
      .map((fts) => {
        const summary = summaryMap.get(fts.thought_id);
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
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const escaped = `"${query.replace(/"/g, '""')}"`;

    return this.db.all<ContextSearchHit>(sql`
      SELECT
        context_id AS contextId,
        thought_id AS thoughtId,
        source_name AS sourceName,
        source_type AS sourceType,
        snippet(fts_contexts, 3, '<mark>', '</mark>', '…', 10) AS snippet,
        rank
      FROM fts_contexts
      WHERE fts_contexts MATCH ${escaped}
      ORDER BY rank
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  async searchAll(query: string, options?: SearchOptions): Promise<SearchAllResult> {
    const [thoughtsResult, contextsResult] = await Promise.all([
      this.searchThoughts(query, options),
      this.searchContexts(query, options),
    ]);
    return { thoughts: thoughtsResult, contexts: contextsResult };
  }
}
