import { getDBInstance } from "@main/db";
import { thoughts } from "@main/db/schema";
import type { FtsContextResult, SearchOptions, SearchResult } from "@shared/search";
import { inArray, sql } from "drizzle-orm";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { assembleThoughtSummaryDTOs, type ThoughtSummaryDTO } from "./ThoughtService";

export type { FtsContextResult, SearchOptions, SearchResult };

export class SearchService extends IpcService {
  static readonly groupName = "search";

  /**
   * Full-text search over thought bodies.
   * Returns matching thoughts with full relations so they can be rendered as cards.
   */
  @IpcMethod()
  async searchThoughts(query: string, options?: SearchOptions): Promise<ThoughtSummaryDTO[]> {
    const db = getDBInstance();
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

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

    return assembleThoughtSummaryDTOs(thoughtRows);
  }

  /** Full-text search over context source names and content. */
  @IpcMethod()
  async searchContexts(query: string, options?: SearchOptions): Promise<FtsContextResult[]> {
    const db = getDBInstance();
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

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

  /** Combined search across thoughts and contexts. */
  @IpcMethod()
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const [thoughtDTOs, ctxResults] = await Promise.all([
      this.searchThoughts(query, options),
      this.searchContexts(query, options),
    ]);
    return { thoughts: thoughtDTOs, contexts: ctxResults };
  }
}
