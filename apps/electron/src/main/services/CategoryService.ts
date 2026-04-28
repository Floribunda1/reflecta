import { getDBInstance } from "@main/db";
import { categories, thoughtCategories, thoughts } from "@main/db/schema";
import type {
  Category,
  CategoryWithCounts,
  CreateCategoryInput,
  ReorderCategoryItem,
  UpdateCategoryInput,
} from "@shared/category";
import { eq, sql } from "drizzle-orm";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { nanoid } from "nanoid";

export type { CategoryWithCounts, CreateCategoryInput, ReorderCategoryItem, UpdateCategoryInput };

export class CategoryService extends IpcService {
  static readonly groupName = "category";

  @IpcMethod()
  async listCategories(): Promise<CategoryWithCounts[]> {
    const db = getDBInstance();
    return db.select().from(categories).orderBy(categories.sortOrder);
  }

  @IpcMethod()
  async reorderCategories(items: ReorderCategoryItem[]): Promise<void> {
    const db = getDBInstance();
    const now = new Date().toISOString();
    for (const item of items) {
      await db
        .update(categories)
        .set({
          parentId: item.parentId,
          sortOrder: item.sortOrder,
          updatedAt: now,
        })
        .where(eq(categories.id, item.id));
    }
  }

  @IpcMethod()
  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const db = getDBInstance();
    const now = new Date().toISOString();
    const parentId = input.parentId ?? null;

    // Place new category at the end of its siblings
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)` })
      .from(categories)
      .where(parentId ? eq(categories.parentId, parentId) : sql`parent_id IS NULL`);
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const rows = await db
      .insert(categories)
      .values({
        id: nanoid(),
        name: input.name,
        parentId,
        sortOrder: nextOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return rows[0];
  }

  @IpcMethod()
  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    const db = getDBInstance();
    const updates: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.name !== undefined) updates.name = input.name;

    if (input.parentId !== undefined) updates.parentId = input.parentId;

    const rows = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    if (rows.length === 0) throw new Error(`Category not found: ${id}`);
    return rows[0];
  }

  /**
   * Hard delete a category.  When `deleteThoughts` is true, all thoughts
   * directly tagged with this category are also deleted.
   */
  @IpcMethod()
  async deleteCategory(id: string, deleteThoughts = false): Promise<void> {
    const db = getDBInstance();
    if (deleteThoughts) {
      const rows = await db
        .select({ thoughtId: thoughtCategories.thoughtId })
        .from(thoughtCategories)
        .where(eq(thoughtCategories.categoryId, id));
      for (const { thoughtId } of rows) {
        await db.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${thoughtId}`);
        await db.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${thoughtId}`);
        await db.delete(thoughts).where(eq(thoughts.id, thoughtId));
      }
    }
    await db.delete(categories).where(eq(categories.id, id));
  }
}
