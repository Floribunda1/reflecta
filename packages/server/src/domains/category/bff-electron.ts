import type { Category } from "./types";
import { CategoryCore } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class CategoryElectronBff extends CategoryCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb());
  }

  async listCategories(): Promise<Category[]> {
    return this.listCategoryRows();
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.getCategoryRow(id);
  }
}
