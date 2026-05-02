import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../../db/schema";

export type ReflectaDb = LibSQLDatabase<typeof schema> & { $client: Client };

export type ThoughtType = "idea" | "insight";
export type SourceType = "experience" | "book" | "article" | "video" | "opinion" | "ai";

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

export type CreateContextInput = {
  thoughtId: string;
  sourceType: SourceType;
  sourceName?: string;
  content: string;
};

export type UpdateContextInput = Partial<
  Pick<CreateContextInput, "sourceType" | "sourceName" | "content">
>;

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

export type SearchOptions = {
  limit?: number;
  offset?: number;
};

export type ListThoughtsFilter = {
  type?: ThoughtType;
  categoryId?: string;
  includeDescendants?: boolean;
};
