import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { categories, thoughtCategories, thoughts } from "../../db/schema";
import type {
  CreateCategoryInput,
  ReflectaDb,
  ReorderCategoryItem,
  UpdateCategoryInput,
} from "./types";

export async function listCategoryRows(
  db: ReflectaDb,
): Promise<Array<typeof categories.$inferSelect>> {
  return db.select().from(categories).orderBy(categories.sortOrder);
}

export async function getCategoryRow(
  db: ReflectaDb,
  id: string,
): Promise<typeof categories.$inferSelect | null> {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createCategory(
  db: ReflectaDb,
  input: CreateCategoryInput,
): Promise<typeof categories.$inferSelect> {
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

export async function updateCategory(
  db: ReflectaDb,
  id: string,
  input: UpdateCategoryInput,
): Promise<typeof categories.$inferSelect> {
  const updates: Partial<typeof categories.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.parentId !== undefined) updates.parentId = input.parentId;

  const rows = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
  if (rows.length === 0) {
    throw new Error(`Category not found: ${id}`);
  }
  return rows[0];
}

export async function deleteCategory(
  db: ReflectaDb,
  id: string,
  deleteThoughts = false,
): Promise<void> {
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

export async function reorderCategories(
  db: ReflectaDb,
  items: ReorderCategoryItem[],
): Promise<void> {
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
