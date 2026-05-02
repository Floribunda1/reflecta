import type { InferSelectModel } from "drizzle-orm";
import type { categories } from "../../db/schema";
import type { ContextDetail } from "../context/types";
import type { ThoughtNode } from "../thought/types";
import type { ReferenceEdge } from "../graph/types";
import type { PageInfo } from "../shared/types";

export type Category = InferSelectModel<typeof categories>;
export type CategoryTreeNode = Omit<Category, "createdAt" | "updatedAt"> & {
  children: CategoryTreeNode[];
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

export type CategoryRef = {
  id: string;
  name: string;
  parentId: string | null;
};

export type CategorySummary = {
  id: string;
  name: string;
  parentId: string | null;
};

export type CategoryInspectResult = {
  category: CategorySummary;
  categories: CategorySummary[];
  thoughts: ThoughtNode[];
  contexts?: ContextDetail[];
  edges?: ReferenceEdge[];
  page: PageInfo;
};

export type InspectCategoryOptions = {
  includeContexts?: boolean;
  includeEdges?: boolean;
  limit?: number;
  offset?: number;
};
