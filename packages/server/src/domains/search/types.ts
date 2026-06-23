import type { UnderstandingSummaryDTO } from "../understanding/types";
import type { ContextSearchHit, ContextSummary } from "../context/types";
import type { UnderstandingSearchHit, UnderstandingSummary } from "../understanding/types";

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

export type SearchHit =
  | {
      type: "understanding";
      understanding: UnderstandingSummary;
      matchedText?: string;
      rank: number;
    }
  | {
      type: "context";
      context: ContextSummary;
      understandingId: string;
      matchedText?: string;
      rank: number;
    };

export type SearchOutput = {
  hits: SearchHit[];
};
