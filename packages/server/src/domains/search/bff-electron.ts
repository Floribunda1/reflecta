import { inArray } from "drizzle-orm";
import { thoughts } from "../../db/schema";
import type { FtsContextResult, SearchOptions, SearchResult } from "./types";
import type { ThoughtSummaryDTO } from "../thought/types";
import { searchContextRows, searchThoughtIds } from "./core";
import { getLimitOffset } from "../shared/core";
import type { ReflectaServerContext } from "../shared/types-electron";
import type { ThoughtService } from "../thought/bff-electron";

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
    const dtos = await this.options.thoughtService.assembleThoughtSummaryDTOs(thoughtRows);
    const dtoMap = new Map(dtos.map((d) => [d.id, d]));
    return thoughtIds
      .map((id) => dtoMap.get(id))
      .filter((d): d is ThoughtSummaryDTO => d !== undefined);
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
