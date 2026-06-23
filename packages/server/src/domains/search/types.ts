import type { UnderstandingSummaryDTO } from "../understanding/types";
import type { ContextSearchHit } from "../context/types";
import type { UnderstandingSearchHit } from "../understanding/types";

export type SearchOptions = {
  limit?: number;
  offset?: number;
};

export type FtsContextResult = {
  contextId: string;
  understandingId: string;
  title: string | null;
  snippet: string;
  rank: number;
};

export type SearchResult = {
  understandings: UnderstandingSummaryDTO[];
  contexts: FtsContextResult[];
};

export type SearchAllResult = {
  understandings: UnderstandingSearchHit[];
  contexts: ContextSearchHit[];
};
