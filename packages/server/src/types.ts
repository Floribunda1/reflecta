import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  categories,
  contexts,
  thoughtCategories,
  thoughtConnections,
  thoughts,
} from "./db/schema.js";

export type ThoughtType = "idea" | "insight";
export type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";

export type Thought = InferSelectModel<typeof thoughts>;
export type NewThought = InferInsertModel<typeof thoughts>;
export type ThoughtCategory = InferSelectModel<typeof thoughtCategories>;
export type ThoughtConnection = InferSelectModel<typeof thoughtConnections>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
export type CategoryWithCounts = Category;
export type CategoryTreeNode = Omit<CategoryWithCounts, "createdAt" | "updatedAt"> & {
  children: CategoryTreeNode[];
};

export type Context = InferSelectModel<typeof contexts>;
export type NewContext = InferInsertModel<typeof contexts>;

export type ContextDTO = {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  createdAt: string;
};

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

export type CreateCategoryInput = {
  name: string;
  parentId?: string | null;
};

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export type ReorderCategoryItem = {
  id: string;
  parentId: string | null;
  sortOrder: number;
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

export type TrashedThoughtDTO = {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  deletedAt: string;
};

export type TrashedContextDTO = {
  id: string;
  thoughtId: string;
  thoughtTitle: string | null;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  deletedAt: string;
};
