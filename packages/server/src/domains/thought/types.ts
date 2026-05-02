import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import type { ContextDTO } from "../context/types";

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
  contexts: ContextDTO[];
  connections: ThoughtConnection[];
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
  categoryId?: string;
  includeDescendants?: boolean;
  searchQuery?: string;
};
