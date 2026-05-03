import { and, eq, inArray, isNull, sql, count } from "drizzle-orm";
import { contexts, thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import type { SourceType } from "../context/types";
import type {
  CreateThoughtInput,
  ListThoughtsFilter,
  ThoughtDTO,
  ThoughtSummaryDTO,
  ThoughtType,
  UpdateThoughtInput,
} from "./types";
import { ThoughtCore } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class ThoughtElectronBff extends ThoughtCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb());
  }

  async assembleThoughtSummaryDTOs(
    thoughtRows: Array<typeof thoughts.$inferSelect>,
  ): Promise<ThoughtSummaryDTO[]> {
    if (thoughtRows.length === 0) return [];

    const db = this.db;
    const ids = thoughtRows.map((t) => t.id);

    const [tcRows, ctxCountRows, connRows] = await Promise.all([
      db.select().from(thoughtCategories).where(inArray(thoughtCategories.thoughtId, ids)),
      db
        .select({ thoughtId: contexts.thoughtId, count: count() })
        .from(contexts)
        .where(and(inArray(contexts.thoughtId, ids), isNull(contexts.deletedAt)))
        .groupBy(contexts.thoughtId),
      db.select().from(thoughtConnections).where(inArray(thoughtConnections.sourceId, ids)),
    ]);

    const tcMap = new Map<string, string[]>();
    for (const r of tcRows) {
      const arr = tcMap.get(r.thoughtId) ?? [];
      arr.push(r.categoryId);
      tcMap.set(r.thoughtId, arr);
    }

    const ctxCountMap = new Map<string, number>();
    for (const r of ctxCountRows) {
      ctxCountMap.set(r.thoughtId, r.count);
    }

    const connMap = new Map<string, string[]>();
    for (const r of connRows) {
      const arr = connMap.get(r.sourceId) ?? [];
      arr.push(r.targetId);
      connMap.set(r.sourceId, arr);
    }

    return thoughtRows.map((t) => ({
      id: t.id,
      type: t.type as ThoughtType,
      title: t.title ?? null,
      body: t.body,
      categoryIds: tcMap.get(t.id) ?? [],
      contextCount: ctxCountMap.get(t.id) ?? 0,
      connectionCount: (connMap.get(t.id) ?? []).length,
      connectionIds: connMap.get(t.id) ?? [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async listThoughts(filter?: ListThoughtsFilter): Promise<ThoughtSummaryDTO[]> {
    let thoughtRows = await this.listThoughtRows({
      type: filter?.type,
      categoryIds: filter?.categoryIds,
      includeDescendants: filter?.includeDescendants,
      limit: filter?.limit,
      offset: filter?.offset,
    });

    if (filter?.searchQuery) {
      const escaped = `"${filter.searchQuery.replace(/"/g, '""')}"*`;
      const ftsRows = await this.db.all<{ thought_id: string }>(
        sql`SELECT thought_id FROM fts_thoughts WHERE fts_thoughts MATCH ${escaped} ORDER BY rank`,
      );
      const matchingIds = new Set(ftsRows.map((r) => r.thought_id));
      thoughtRows = thoughtRows.filter((t) => matchingIds.has(t.id));
    }

    return this.assembleThoughtSummaryDTOs(thoughtRows);
  }

  async getThoughtById(id: string): Promise<ThoughtDTO | null> {
    const row = await this.getThoughtRow(id);
    if (!row) return null;

    const [tcRows, ctxRows, connRows, refRows] = await Promise.all([
      this.db.select().from(thoughtCategories).where(eq(thoughtCategories.thoughtId, id)),
      this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.thoughtId, id), isNull(contexts.deletedAt))),
      this.db.select().from(thoughtConnections).where(eq(thoughtConnections.sourceId, id)),
      this.db.select().from(thoughtConnections).where(eq(thoughtConnections.targetId, id)),
    ]);

    const connectionIds = connRows.map((r) => r.targetId);
    const connections =
      connectionIds.length > 0
        ? await this.assembleThoughtSummaryDTOs(
            await this.db.select().from(thoughts).where(inArray(thoughts.id, connectionIds)),
          )
        : [];

    const referencedByIds = refRows.map((r) => r.sourceId);
    const referencedBy =
      referencedByIds.length > 0
        ? await this.assembleThoughtSummaryDTOs(
            await this.db.select().from(thoughts).where(inArray(thoughts.id, referencedByIds)),
          )
        : [];

    return {
      id: row.id,
      type: row.type as ThoughtType,
      title: row.title ?? null,
      body: row.body,
      categoryIds: tcRows.map((r) => r.categoryId),
      contexts: ctxRows.map((r) => ({ ...r, sourceType: r.sourceType as SourceType })),
      connections,
      referencedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createThought(input: CreateThoughtInput): Promise<ThoughtDTO> {
    const row = await super._createThought(input);
    const dto = await this.getThoughtById(row.id);
    if (!dto) throw new Error(`Thought not found after creation: ${row.id}`);
    return dto;
  }

  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDTO> {
    const row = await super._updateThought(id, input);
    const dto = await this.getThoughtById(row.id);
    if (!dto) throw new Error(`Thought not found after update: ${row.id}`);
    return dto;
  }

  async listRecentThoughts(limit = 20): Promise<ThoughtSummaryDTO[]> {
    const rows = await this.listRecentThoughtRows(limit);
    return this.assembleThoughtSummaryDTOs(rows);
  }
}
