import type { categories } from "@main/db/schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type CategoryWithCounts = Category;

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
// ----------------------------------------------------------------
// Inferred row types
// ----------------------------------------------------------------
export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
export type CategoryTreeNode = Omit<CategoryWithCounts, "createdAt" | "updatedAt"> & {
  children: CategoryTreeNode[];
};
