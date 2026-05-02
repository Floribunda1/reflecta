import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  categories,
  contexts,
  thoughtCategories,
  thoughtConnections,
  thoughts,
} from "../../db/schema";
import type { ReflectaDb } from "../electron/types";
import { getCategoryDescendants, makePageInfo, toThoughtSummaries } from "./shared";
import type {
  CategoryInspectResult,
  CategorySummary,
  ContextDetail,
  CreateCategoryInput,
  InspectCategoryOptions,
  SourceType,
  ThoughtNode,
  UpdateCategoryInput,
} from "./types";

export class CategoryService {
  constructor(private db: ReflectaDb) {}

  async listCategories(): Promise<CategorySummary[]> {
    const rows = await this.db.select().from(categories).orderBy(categories.sortOrder);
    return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId }));
  }

  async getCategory(id: string): Promise<CategorySummary> {
    const rows = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (rows.length === 0) {
      throw new Error(`Category not found: ${id}`);
    }
    const r = rows[0];
    return { id: r.id, name: r.name, parentId: r.parentId };
  }

  async inspectCategory(
    id: string,
    options?: InspectCategoryOptions,
  ): Promise<CategoryInspectResult> {
    const categoryRows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (categoryRows.length === 0) {
      throw new Error(`Category not found: ${id}`);
    }

    const category = categoryRows[0];
    const allCats = await this.db.select().from(categories).orderBy(categories.sortOrder);

    const descendantIds = await getCategoryDescendants(this.db, id);
    const targetCatIds = [id, ...descendantIds];

    const limit = options?.limit ?? 200;
    const offset = options?.offset ?? 0;

    const thoughtRows = await this.db
      .select()
      .from(thoughts)
      .where(
        and(
          isNull(thoughts.deletedAt),
          inArray(
            thoughts.id,
            this.db
              .select({ id: thoughtCategories.thoughtId })
              .from(thoughtCategories)
              .where(inArray(thoughtCategories.categoryId, targetCatIds)),
          ),
        ),
      )
      .orderBy(desc(thoughts.updatedAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = thoughtRows.length > limit;
    const paginatedThoughtRows = thoughtRows.slice(0, limit);
    const thoughtIds = paginatedThoughtRows.map((t) => t.id);

    const summaries = await toThoughtSummaries(this.db, paginatedThoughtRows);
    const nodeThoughts: ThoughtNode[] = summaries.map((s) => ({ ...s }));

    let resultContexts: ContextDetail[] | undefined;
    let resultEdges: { from: string; to: string }[] | undefined;

    if (options?.includeContexts) {
      const ctxRows = await this.db
        .select()
        .from(contexts)
        .where(and(inArray(contexts.thoughtId, thoughtIds), isNull(contexts.deletedAt)));

      const ctxMap = new Map<string, string[]>();
      for (const ctx of ctxRows) {
        const arr = ctxMap.get(ctx.thoughtId) ?? [];
        arr.push(ctx.id);
        ctxMap.set(ctx.thoughtId, arr);
      }

      for (const node of nodeThoughts) {
        node.contextIds = ctxMap.get(node.id) ?? [];
      }

      resultContexts = ctxRows.map((r) => ({
        id: r.id,
        thoughtId: r.thoughtId,
        sourceType: r.sourceType as SourceType,
        sourceName: r.sourceName ?? null,
        content: r.content,
      }));
    }

    if (options?.includeEdges) {
      const [outRows, inRows] = await Promise.all([
        this.db
          .select()
          .from(thoughtConnections)
          .where(inArray(thoughtConnections.sourceId, thoughtIds)),
        this.db
          .select()
          .from(thoughtConnections)
          .where(inArray(thoughtConnections.targetId, thoughtIds)),
      ]);

      const edgeSet = new Set<string>();
      resultEdges = [];

      for (const e of outRows) {
        const key = `${e.sourceId}->${e.targetId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          resultEdges.push({ from: e.sourceId, to: e.targetId });
        }
      }

      for (const e of inRows) {
        const key = `${e.sourceId}->${e.targetId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          resultEdges.push({ from: e.sourceId, to: e.targetId });
        }
      }
    }

    return {
      category: { id: category.id, name: category.name, parentId: category.parentId },
      categories: allCats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
      thoughts: nodeThoughts,
      contexts: resultContexts,
      edges: resultEdges,
      page: makePageInfo(limit, offset, hasMore),
    };
  }

  async createCategory(input: CreateCategoryInput): Promise<CategorySummary> {
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

    const r = rows[0];
    return { id: r.id, name: r.name, parentId: r.parentId };
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<CategorySummary> {
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

    const r = rows[0];
    return { id: r.id, name: r.name, parentId: r.parentId };
  }

  async deleteCategory(id: string, deleteThoughts = false): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (deleteThoughts) {
        const tcRows = await tx
          .select({ thoughtId: thoughtCategories.thoughtId })
          .from(thoughtCategories)
          .where(eq(thoughtCategories.categoryId, id));
        for (const { thoughtId } of tcRows) {
          await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${thoughtId}`);
          await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${thoughtId}`);
          await tx.delete(thoughts).where(eq(thoughts.id, thoughtId));
        }
      }
      await tx.delete(categories).where(eq(categories.id, id));
    });
  }
}
