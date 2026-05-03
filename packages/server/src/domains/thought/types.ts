import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import type { CategoryRef } from "../category/types";
import type { ContextDTO, ContextDetail } from "../context/types";

export type ThoughtType = "idea" | "insight";

export type Thought = InferSelectModel<typeof thoughts>;
export type NewThought = InferInsertModel<typeof thoughts>;
export type ThoughtCategory = InferSelectModel<typeof thoughtCategories>;
export type ThoughtConnection = InferSelectModel<typeof thoughtConnections>;

export type ThoughtSummaryDTO = {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categoryIds: string[];
  contextCount: number;
  connectionCount: number;
  connectionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ThoughtDTO = {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categoryIds: string[];
  contexts: ContextDTO[];
  connections: ThoughtSummaryDTO[];
  referencedBy: ThoughtSummaryDTO[];
  createdAt: string;
  updatedAt: string;
};

export type CreateThoughtInput = {
  type: ThoughtType;
  title?: string;
  body?: string;
  categoryIds?: string[];
};

export type UpdateThoughtInput = {
  type?: ThoughtType;
  title?: string | null;
  body?: string;
  categoryIds?: string[];
};

export type ListThoughtsFilter = {
  type?: ThoughtType;
  categoryIds?: string[];
  includeDescendants?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
};

export type ThoughtSummary = {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categories: CategoryRef[];
};

export type ThoughtNode = ThoughtSummary & {
  contextIds?: string[];
};

export type ThoughtSearchHit = ThoughtSummary & {
  snippet: string;
  rank: number;
};

export type ThoughtDetail = ThoughtSummary & {
  contextCount: number;
  referenceCount: number;
  referencedByCount: number;
  contexts?: ContextDetail[];
  references?: ThoughtSummary[];
  referencedBys?: ThoughtSummary[];
};

export type GetThoughtOptions = {
  includeContexts?: boolean;
  includeReferences?: boolean;
  includeReferencedBys?: boolean;
};
