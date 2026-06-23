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

  async searchUnderstandingIds(
    query: string,
    options?: SearchOptions,
  ): Promise<Array<{ understandingId: string; snippet: string; rank: number }>> {
    const { limit, offset } = getLimitOffset(options);
    const escaped = escapeFtsQuery(query);

    const rows = await this.db.all<{
      understanding_id: string;
      snippet: string;
      rank: number;
    }>(sql`
      SELECT
        understanding_id,
        snippet(fts_understandings, 1, '<mark>', '</mark>', '…', 10) AS snippet,
        rank
      FROM fts_understandings
      WHERE fts_understandings MATCH ${escaped}
      ORDER BY rank
      LIMIT ${limit} OFFSET ${offset}
    `);

    return rows.map((r) => ({
      understandingId: r.understanding_id,
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
      understandingId: string;
      medium: string;
      title: string | null;
      snippet: string;
      rank: number;
    }>
  > {
    const { limit, offset } = getLimitOffset(options);
    const escaped = escapeFtsQuery(query);

    const rows = await this.db.all<{
      context_id: string;
      understanding_id: string;
      medium: string;
      title: string | null;
      snippet: string;
      rank: number;
    }>(sql`
      SELECT
        c.id AS context_id,
        c.understanding_id AS understanding_id,
        c.medium AS medium,
        c.title AS title,
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
      understandingId: r.understanding_id,
      medium: r.medium,
      title: r.title,
      snippet: r.snippet,
      rank: r.rank,
    }));
  }
}
