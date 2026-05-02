import type { contexts } from "../../db/schema";

export type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";

export type ContextDTO = Omit<typeof contexts.$inferSelect, "sourceType"> & {
  sourceType: SourceType;
};

export type CreateContextInput = {
  thoughtId: string;
  sourceType: SourceType;
  sourceName?: string;
  content: string;
};

export type UpdateContextInput = Partial<
  Pick<CreateContextInput, "sourceType" | "sourceName" | "content">
>;

export type ContextSummary = {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
};

export type ContextDetail = ContextSummary & {
  content: string;
};

export type ContextSearchHit = {
  contextId: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  snippet: string;
  rank: number;
};
