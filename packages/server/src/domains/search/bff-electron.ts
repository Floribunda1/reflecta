import { inArray } from "drizzle-orm";
import { thoughts } from "../../db/schema";
import type { FtsContextResult, SearchOptions, SearchResult } from "./types";
import type { ThoughtSummaryDTO } from "../thought/types";
import { SearchCore } from "./core";
import { getLimitOffset } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";
import type { ThoughtElectronBff } from "../thought/bff-electron";

export class SearchElectronBff extends SearchCore {
  private readonly thoughtService: ThoughtElectronBff;

  constructor(options: ReflectaServerContext & { thoughtService: ThoughtElectronBff }) {
    super(options.getDb());
    this.thoughtService = options.thoughtService;
  }

  async searchThoughts(query: string, options?: SearchOptions): Promise<ThoughtSummaryDTO[]> {
    const { limit, offset } = getLimitOffset(options);
    const ftsRows = await this.searchThoughtIds(query, { limit, offset });
    if (ftsRows.length === 0) return [];

    const thoughtIds = ftsRows.map((r) => r.thoughtId);
    const thoughtRows = await this.db
      .select()
      .from(thoughts)
      .where(inArray(thoughts.id, thoughtIds));
    const dtos = await this.thoughtService.assembleThoughtSummaryDTOs(thoughtRows);
    const dtoMap = new Map(dtos.map((d) => [d.id, d]));
    return thoughtIds
      .map((id) => dtoMap.get(id))
      .filter((d): d is ThoughtSummaryDTO => d !== undefined);
  }

  async searchContexts(query: string, options?: SearchOptions): Promise<FtsContextResult[]> {
    const { limit, offset } = getLimitOffset(options);
    const rows = await this.searchContextRows(query, { limit, offset });
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
