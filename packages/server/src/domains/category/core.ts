import { eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { categories, thoughtCategories, thoughts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { CreateCategoryInput, ReorderCategoryItem, UpdateCategoryInput } from "./types";

export class CategoryCore {
  constructor(protected db: ReflectaDb) {}

  async listCategoryRows(): Promise<Array<typeof categories.$inferSelect>> {
    return this.db.select().from(categories).orderBy(categories.sortOrder);
  }

  async getCategoryRow(id: string): Promise<typeof categories.$inferSelect | null> {
    const rows = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createCategory(input: CreateCategoryInput): Promise<typeof categories.$inferSelect> {
    const createdAt = new Date().toISOString();
    const parentId = input.parentId ?? null;

    const maxOrderResult = await this.db
      .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)` })
      .from(categories)
      .where(parentId ? eq(categories.parentId, parentId) : sql`parent_id IS NULL`);
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const rows = await this.db
      .insert(categories)
      .values({
        id: nanoid(),
        name: input.name,
        parentId,
        sortOrder: nextOrder,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    return rows[0];
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<typeof categories.$inferSelect> {
    const updates: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.parentId !== undefined) updates.parentId = input.parentId;

    const rows = await this.db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    if (rows.length === 0) {
      throw new Error(`Category not found: ${id}`);
    }
    return rows[0];
  }

  async deleteCategory(id: string, deleteThoughts = false): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (deleteThoughts) {
        const rows = await tx
          .select({ thoughtId: thoughtCategories.thoughtId })
          .from(thoughtCategories)
          .where(eq(thoughtCategories.categoryId, id));
        const thoughtIds = rows.map((r) => r.thoughtId);
        if (thoughtIds.length > 0) {
          const idList = sql.join(thoughtIds.map((tid) => sql`${tid}`));
          await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id IN (${idList})`);
          await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id IN (${idList})`);
          await tx.delete(thoughts).where(inArray(thoughts.id, thoughtIds));
        }
      }
      await tx.delete(categories).where(eq(categories.id, id));
    });
  }

  async reorderCategories(items: ReorderCategoryItem[]): Promise<void> {
    const updatedAt = new Date().toISOString();
    await this.db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(categories)
          .set({
            parentId: item.parentId,
            sortOrder: item.sortOrder,
            updatedAt,
          })
          .where(eq(categories.id, item.id));
      }
    });
  }
}
