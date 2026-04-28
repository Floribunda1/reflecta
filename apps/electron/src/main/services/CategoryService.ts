import type {
  Category,
  CategoryWithCounts,
  CreateCategoryInput,
  ReorderCategoryItem,
  UpdateCategoryInput,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { categoryService } from "./core";

export class CategoryService extends IpcService {
  static readonly groupName = "category";

  @IpcMethod()
  async listCategories(): Promise<CategoryWithCounts[]> {
    return categoryService.listCategories();
  }

  @IpcMethod()
  async reorderCategories(items: ReorderCategoryItem[]): Promise<void> {
    return categoryService.reorderCategories(items);
  }

  @IpcMethod()
  async createCategory(input: CreateCategoryInput): Promise<Category> {
    return categoryService.createCategory(input);
  }

  @IpcMethod()
  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    return categoryService.updateCategory(id, input);
  }

  @IpcMethod()
  async deleteCategory(id: string, deleteThoughts = false): Promise<void> {
    return categoryService.deleteCategory(id, deleteThoughts);
  }
}
