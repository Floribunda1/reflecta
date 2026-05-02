import type { ThoughtSummaryDTO } from "../thought/types";
import type { ContextSearchHit } from "../context/types";
import type { ThoughtSearchHit } from "../thought/types";

export type SearchOptions = {
  limit?: number;
  offset?: number;
};

export type FtsContextResult = {
  contextId: string;
  thoughtId: string;
  sourceName: string | null;
  snippet: string;
  rank: number;
};

export type SearchResult = {
  thoughts: ThoughtSummaryDTO[];
  contexts: FtsContextResult[];
};

export type SearchAllResult = {
  thoughts: ThoughtSearchHit[];
  contexts: ContextSearchHit[];
};
