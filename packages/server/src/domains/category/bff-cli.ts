import { and, desc, inArray, isNull } from "drizzle-orm";
import { contexts, thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { CategoryCore } from "./core";
import { getCategoryDescendants, makePageInfo } from "../shared/core";
import { toThoughtSummaries } from "../shared/bff-cli";
import type {
  CategoryInspectResult,
  CategorySummary,
  ContextDetail,
  CreateCategoryInput,
  InspectCategoryOptions,
  SourceType,
  ThoughtNode,
  UpdateCategoryInput,
} from "../shared/types-cli";

export class CategoryCliBff extends CategoryCore {
  constructor(db: ReflectaDb) {
    super(db);
  }

  async listCategories(): Promise<CategorySummary[]> {
    const rows = await this.listCategoryRows();
    return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId }));
  }

  async getCategory(id: string): Promise<CategorySummary> {
    const row = await this.getCategoryRow(id);
    if (!row) {
      throw new Error(`Category not found: ${id}`);
    }
    return { id: row.id, name: row.name, parentId: row.parentId };
  }

  async inspectCategory(
    id: string,
    options?: InspectCategoryOptions,
  ): Promise<CategoryInspectResult> {
    const category = await this.getCategoryRow(id);
    if (!category) {
      throw new Error(`Category not found: ${id}`);
    }

    const allCats = await this.listCategoryRows();

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

  async createCategorySummary(input: CreateCategoryInput): Promise<CategorySummary> {
    const row = await super.createCategory(input);
    return { id: row.id, name: row.name, parentId: row.parentId };
  }

  async updateCategorySummary(id: string, input: UpdateCategoryInput): Promise<CategorySummary> {
    const row = await super.updateCategory(id, input);
    return { id: row.id, name: row.name, parentId: row.parentId };
  }
}
