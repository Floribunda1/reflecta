import type { ContextMedium } from "@reflecta/shared";

export type {
  ContextDTO,
  CreateContextInput,
  UpdateContextInput,
  ContextMedium,
} from "@reflecta/shared";

export type ContextSummary = {
  id: string;
  understandingId: string;
  medium: ContextMedium;
  title: string | null;
};

export type ContextDetail = ContextSummary & {
  content: string;
};

export type ContextSearchHit = {
  contextId: string;
  understandingId: string;
  medium: ContextMedium;
  title: string | null;
  snippet: string;
  rank: number;
};
