import type { contexts } from "../../db/schema";

export type ContextMedium =
  | "experience"
  | "video"
  | "book"
  | "article"
  | "opinion"
  | "ai"
  | "other";

export type ContextDTO = Omit<typeof contexts.$inferSelect, "medium"> & {
  medium: ContextMedium;
};

export type CreateContextInput = {
  understandingId: string;
  medium: ContextMedium;
  title?: string;
  content: string;
};

export type UpdateContextInput = Partial<
  Pick<CreateContextInput, "understandingId" | "medium" | "title" | "content">
>;

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
