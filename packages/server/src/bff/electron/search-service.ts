import { inArray } from "drizzle-orm";
import { thoughts } from "../../db/schema";
import type { FtsContextResult, SearchOptions, SearchResult, ThoughtSummaryDTO } from "../../types";
import { searchContextRows, searchThoughtIds } from "../core/search-core";
import { getLimitOffset } from "../core/shared";
import type { ReflectaServerContext } from "./types";
import type { ThoughtService } from "./thought-service";

export class SearchService {
  constructor(
    private readonly options: ReflectaServerContext & { thoughtService: ThoughtService },
  ) {}

  async searchThoughts(query: string, options?: SearchOptions): Promise<ThoughtSummaryDTO[]> {
    const db = this.options.getDb();
    const { limit, offset } = getLimitOffset(options);
    const ftsRows = await searchThoughtIds(db, query, { limit, offset });
    if (ftsRows.length === 0) return [];

    const thoughtIds = ftsRows.map((r) => r.thoughtId);
    const thoughtRows = await db.select().from(thoughts).where(inArray(thoughts.id, thoughtIds));
    return this.options.thoughtService.assembleThoughtSummaryDTOs(thoughtRows);
  }

  async searchContexts(query: string, options?: SearchOptions): Promise<FtsContextResult[]> {
    const db = this.options.getDb();
    const { limit, offset } = getLimitOffset(options);
    const rows = await searchContextRows(db, query, { limit, offset });
    return rows.map((r) => ({
      contextId: r.contextId,
      thoughtId: r.thoughtId,
      sourceName: r.sourceName,
      snippet: r.snippet,
      rank: r.rank,
    }));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const [thoughtDTOs, ctxResults] = await Promise.all([
      this.searchThoughts(query, options),
      this.searchContexts(query, options),
    ]);
    return { thoughts: thoughtDTOs, contexts: ctxResults };
  }
}
