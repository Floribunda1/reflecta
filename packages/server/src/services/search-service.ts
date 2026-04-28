import { sql, inArray } from "drizzle-orm";
import { thoughts } from "../db/schema.js";
import type { FtsContextResult, SearchOptions, SearchResult, ThoughtSummaryDTO } from "../types.js";
import { getLimitOffset } from "./shared.js";
import type { ReflectaServerContext } from "./types.js";
import type { ThoughtService } from "./thought-service.js";

export class SearchService {
  constructor(
    private readonly options: ReflectaServerContext & { thoughtService: ThoughtService },
  ) {}

  async searchThoughts(query: string, options?: SearchOptions): Promise<ThoughtSummaryDTO[]> {
    const db = this.options.getDb();
    const { limit, offset } = getLimitOffset(options);
    const ftsRows = await db.all<{ thought_id: string }>(sql`
      SELECT thought_id
      FROM fts_thoughts
      WHERE fts_thoughts MATCH ${query}
      ORDER BY rank
      LIMIT ${limit} OFFSET ${offset}
    `);
    if (ftsRows.length === 0) return [];

    const thoughtIds = ftsRows.map((r) => r.thought_id);
    const thoughtRows = await db.select().from(thoughts).where(inArray(thoughts.id, thoughtIds));
    return this.options.thoughtService.assembleThoughtSummaryDTOs(thoughtRows);
  }

  async searchContexts(query: string, options?: SearchOptions): Promise<FtsContextResult[]> {
    const db = this.options.getDb();
    const { limit, offset } = getLimitOffset(options);

    return db.all<FtsContextResult>(sql`
      SELECT
        context_id  AS contextId,
        thought_id  AS thoughtId,
        source_name AS sourceName,
        snippet(fts_contexts, 3, '<mark>', '</mark>', '…', 10) AS snippet,
        rank
      FROM fts_contexts
      WHERE fts_contexts MATCH ${query}
      ORDER BY rank
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const [thoughtDTOs, ctxResults] = await Promise.all([
      this.searchThoughts(query, options),
      this.searchContexts(query, options),
    ]);
    return { thoughts: thoughtDTOs, contexts: ctxResults };
  }
}
