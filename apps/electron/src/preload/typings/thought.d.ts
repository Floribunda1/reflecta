import type { thoughtCategories, thoughtConnections, thoughts } from "@main/db/schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ContextDTO } from "./context";

export type ThoughtType = "idea" | "insight";

export type Thought = InferSelectModel<typeof thoughts>;
export type NewThought = InferInsertModel<typeof thoughts>;
export type ThoughtCategory = InferSelectModel<typeof thoughtCategories>;
export type ThoughtConnection = InferSelectModel<typeof thoughtConnections>;

/** Lightweight DTO for list views — contexts and connections as counts only. */
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

/** Full DTO for single-thought detail — includes full contexts and resolved connections. */
export type ThoughtDTO = {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categoryIds: string[];
  contexts: ContextDTO[];
  /** Thoughts this thought links to (outgoing). */
  connections: ThoughtSummaryDTO[];
  /** Thoughts that link to this thought (incoming). */
  referencedBy: ThoughtSummaryDTO[];
  createdAt: string;
  updatedAt: string;
};

export type CreateThoughtInput = {
  type: ThoughtType;
  title?: string;
  body?: string;
  /** Category IDs to assign on creation. */
  categoryIds?: string[];
};

export type UpdateThoughtInput = {
  type?: ThoughtType;
  title?: string | null;
  body?: string;
  /**
   * Replaces the full category set atomically.
   * Omit to leave categories unchanged.
   */
  categoryIds?: string[];
};

export type ListThoughtsFilter = {
  type?: ThoughtType;
  categoryId?: string;
  /** When true, also includes thoughts in all sub-categories. */
  includeDescendants?: boolean;
  /** Full-text search query over thought bodies. Supports FTS5 prefix matching. */
  searchQuery?: string;
};
