import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { categories } from "../../db/schema";

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
export type CategoryWithCounts = Category;
export type CategoryTreeNode = Omit<CategoryWithCounts, "createdAt" | "updatedAt"> & {
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
