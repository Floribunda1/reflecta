import type { UnderstandingSummaryDTO } from "../understanding/types";
import type { ContextSummary } from "../context/types";
import type { UnderstandingSummary } from "../understanding/types";

export type SearchOptions = {
  limit?: number;
  offset?: number;
};

export type SearchContextResult = {
  contextId: string;
  understandingId: string;
  title: string | null;
  snippet: string;
  rank: number;
};

export type SearchResult = {
  understandings: UnderstandingSummaryDTO[];
  contexts: SearchContextResult[];
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
