import type { ThoughtSummaryDTO } from "./thought";

export type SearchOptions = {
  limit?: number;
  offset?: number;
};

/** FTS result row from fts_contexts. */
export type FtsContextResult = {
  contextId: string;
  thoughtId: string;
  sourceName: string | null;
  snippet: string;
  rank: number;
};

export type SearchResult = {
  /** Matched thoughts with summary relations (ready to render as ThoughtCard). */
  thoughts: ThoughtSummaryDTO[];
  contexts: FtsContextResult[];
};
