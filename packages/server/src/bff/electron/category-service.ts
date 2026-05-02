import {
  createCategory as coreCreateCategory,
  deleteCategory as coreDeleteCategory,
  listCategoryRows,
  reorderCategories as coreReorderCategories,
  updateCategory as coreUpdateCategory,
} from "../core/category-core";
import type {
  Category,
  CategoryWithCounts,
  CreateCategoryInput,
  ReorderCategoryItem,
  UpdateCategoryInput,
} from "../../types";
import type { ReflectaServerContext } from "./types";

export class CategoryService {
  constructor(private readonly options: ReflectaServerContext) {}

  async listCategories(): Promise<CategoryWithCounts[]> {
    return listCategoryRows(this.options.getDb());
  }

  async reorderCategories(items: ReorderCategoryItem[]): Promise<void> {
    await coreReorderCategories(this.options.getDb(), items);
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    return coreCreateCategory(this.options.getDb(), input);
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    return coreUpdateCategory(this.options.getDb(), id, input);
  }

  async deleteCategory(id: string, deleteThoughts = false): Promise<void> {
    await coreDeleteCategory(this.options.getDb(), id, deleteThoughts);
  }
}
