import { eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { categories, thoughtCategories, thoughts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { CreateCategoryInput, ReorderCategoryItem, UpdateCategoryInput } from "./types";

export async function getCategoryDescendants(
  db: ReflectaDb,
  categoryId: string,
): Promise<string[]> {
  const result = await db.all<{ id: string }>(sql`
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM categories WHERE parent_id = ${categoryId}
      UNION ALL
      SELECT c.id FROM categories c
      INNER JOIN descendants d ON c.parent_id = d.id
    )
    SELECT id FROM descendants
  `);
  return result.map((r) => r.id);
}

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
    await this.assertValidParent(undefined, parentId);

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
    if (input.parentId !== undefined) {
      await this.assertValidParent(id, input.parentId);
    }

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
    const category = await this.getCategoryRow(id);
    if (!category) {
      throw new Error(`Category not found: ${id}`);
    }
    await this.db.transaction((tx) => {
      if (deleteThoughts) {
        const rows = tx
          .select({ thoughtId: thoughtCategories.thoughtId })
          .from(thoughtCategories)
          .where(eq(thoughtCategories.categoryId, id))
          .all();
        const thoughtIds = rows.map((r) => r.thoughtId);
        if (thoughtIds.length > 0) {
          const idList = sql.join(thoughtIds.map((tid) => sql`${tid}`));
          tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id IN (${idList})`);
          tx.run(sql`DELETE FROM fts_contexts WHERE thought_id IN (${idList})`);
          tx.delete(thoughts).where(inArray(thoughts.id, thoughtIds)).run();
        }
      }
      tx.delete(categories).where(eq(categories.id, id)).run();
    });
  }

  async reorderCategories(items: ReorderCategoryItem[]): Promise<void> {
    const updatedAt = new Date().toISOString();
    await this.db.transaction((tx) => {
      for (const item of items) {
        tx.update(categories)
          .set({
            parentId: item.parentId,
            sortOrder: item.sortOrder,
            updatedAt,
          })
          .where(eq(categories.id, item.id))
          .run();
      }
    });
  }

  private async assertValidParent(id: string | undefined, parentId: string | null): Promise<void> {
    if (parentId === null) return;
    if (parentId === id) throw new Error("Category cannot be its own parent");
    if (!(await this.getCategoryRow(parentId))) {
      throw new Error(`Category not found: ${parentId}`);
    }
    if (!id) return;
    const descendants = await getCategoryDescendants(this.db, id);
    if (descendants.includes(parentId)) {
      throw new Error("Category cannot be moved under its descendant");
    }
  }
}

export async function resolveCategoryRefs(
  db: ReflectaDb,
  thoughtIds: string[],
): Promise<Map<string, { id: string; name: string; parentId: string | null }[]>> {
  if (thoughtIds.length === 0) return new Map();

  const tcRows = await db
    .select()
    .from(thoughtCategories)
    .where(inArray(thoughtCategories.thoughtId, thoughtIds));

  const categoryIds = [...new Set(tcRows.map((tc) => tc.categoryId))];
  const catRows =
    categoryIds.length > 0
      ? await db.select().from(categories).where(inArray(categories.id, categoryIds))
      : [];
  const catMap = new Map(catRows.map((c) => [c.id, c]));

  const result = new Map<string, { id: string; name: string; parentId: string | null }[]>();
  for (const tc of tcRows) {
    const cat = catMap.get(tc.categoryId);
    if (!cat) continue;
    const refs = result.get(tc.thoughtId) ?? [];
    refs.push({ id: cat.id, name: cat.name, parentId: cat.parentId });
    result.set(tc.thoughtId, refs);
  }
  return result;
}
