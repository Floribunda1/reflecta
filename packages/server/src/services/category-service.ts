import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { categories, thoughtCategories, thoughts } from "../db/schema";
import type {
  Category,
  CategoryWithCounts,
  CreateCategoryInput,
  ReorderCategoryItem,
  UpdateCategoryInput,
} from "../types";
import type { ReflectaServerContext } from "./types";

export class CategoryService {
  constructor(private readonly options: ReflectaServerContext) {}

  async listCategories(): Promise<CategoryWithCounts[]> {
    const db = this.options.getDb();
    return db.select().from(categories).orderBy(categories.sortOrder);
  }

  async reorderCategories(items: ReorderCategoryItem[]): Promise<void> {
    const db = this.options.getDb();
    const updatedAt = new Date().toISOString();
    for (const item of items) {
      await db
        .update(categories)
        .set({
          parentId: item.parentId,
          sortOrder: item.sortOrder,
          updatedAt,
        })
        .where(eq(categories.id, item.id));
    }
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const db = this.options.getDb();
    const createdAt = new Date().toISOString();
    const parentId = input.parentId ?? null;

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
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    return rows[0];
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    const db = this.options.getDb();
    const updates: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.parentId !== undefined) updates.parentId = input.parentId;

    const rows = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    if (rows.length === 0) throw new Error(`Category not found: ${id}`);
    return rows[0];
  }

  async deleteCategory(id: string, deleteThoughts = false): Promise<void> {
    const db = this.options.getDb();
    await db.transaction(async (tx) => {
      if (deleteThoughts) {
        const rows = await tx
          .select({ thoughtId: thoughtCategories.thoughtId })
          .from(thoughtCategories)
          .where(eq(thoughtCategories.categoryId, id));
        for (const { thoughtId } of rows) {
          await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${thoughtId}`);
          await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${thoughtId}`);
          await tx.delete(thoughts).where(eq(thoughts.id, thoughtId));
        }
      }
      await tx.delete(categories).where(eq(categories.id, id));
    });
  }
}
