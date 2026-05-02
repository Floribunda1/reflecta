import { sql } from "drizzle-orm";
import type { ReflectaDb } from "../../db/types";
import type { SearchOptions } from "./types";
import { escapeFtsQuery, getLimitOffset } from "../shared/core";

export async function searchThoughtIds(
  db: ReflectaDb,
  query: string,
  options?: SearchOptions,
): Promise<Array<{ thoughtId: string; snippet: string; rank: number }>> {
  const { limit, offset } = getLimitOffset(options);
  const escaped = escapeFtsQuery(query);

  const rows = await db.all<{
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

export async function searchContextRows(
  db: ReflectaDb,
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

  const rows = await db.all<{
    context_id: string;
    thought_id: string;
    source_type: string;
    source_name: string | null;
    snippet: string;
    rank: number;
  }>(sql`
    SELECT
      context_id AS contextId,
      thought_id AS thoughtId,
      source_type AS sourceType,
      source_name AS sourceName,
      snippet(fts_contexts, 3, '<mark>', '</mark>', '…', 10) AS snippet,
      rank
    FROM fts_contexts
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
