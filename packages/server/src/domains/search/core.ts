import { sql } from "drizzle-orm";
import type { ReflectaDb } from "../../db/types";
import type { SearchOptions } from "./types";

export function getLimitOffset(options?: SearchOptions) {
  return {
    limit: options?.limit ?? 20,
    offset: options?.offset ?? 0,
  };
}

export function escapeFtsQuery(query: string): string {
  return query.replace(/"/g, '""');
}

export class SearchCore {
  constructor(protected db: ReflectaDb) {}

  async searchThoughtIds(
    query: string,
    options?: SearchOptions,
  ): Promise<Array<{ thoughtId: string; snippet: string; rank: number }>> {
    const { limit, offset } = getLimitOffset(options);
    const escaped = escapeFtsQuery(query);

    const rows = await this.db.all<{
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

    return rows.map((r) => ({
      thoughtId: r.thought_id,
      snippet: r.snippet,
      rank: r.rank,
    }));
  }

  async searchContextRows(
    query: string,
    options?: SearchOptions,
  ): Promise<
    Array<{
      contextId: string;
      thoughtId: string;
      sourceType: string;
      sourceName: string | null;
      snippet: string;
      rank: number;
    }>
  > {
    const { limit, offset } = getLimitOffset(options);
    const escaped = escapeFtsQuery(query);

    const rows = await this.db.all<{
      context_id: string;
      thought_id: string;
      source_type: string;
      source_name: string | null;
      snippet: string;
      rank: number;
    }>(sql`
      SELECT
        c.id AS context_id,
        c.thought_id AS thought_id,
        c.source_type AS source_type,
        c.source_name AS source_name,
        snippet(fts_contexts, 3, '<mark>', '</mark>', '…', 10) AS snippet,
        rank
      FROM fts_contexts
      JOIN contexts c ON c.id = fts_contexts.context_id
      WHERE fts_contexts MATCH ${escaped}
      ORDER BY rank
      LIMIT ${limit} OFFSET ${offset}
    `);

    return rows.map((r) => ({
      contextId: r.context_id,
      thoughtId: r.thought_id,
      sourceType: r.source_type,
      sourceName: r.source_name,
      snippet: r.snippet,
      rank: r.rank,
    }));
  }
}
