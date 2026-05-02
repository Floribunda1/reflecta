import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { contexts, thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import type {
  CreateThoughtInput,
  ListThoughtsFilter,
  ThoughtDTO,
  ThoughtSummaryDTO,
  ThoughtType,
  UpdateThoughtInput,
} from "../../types";
import {
  addConnection as coreAddConnection,
  createThought as coreCreateThought,
  deleteThought as coreDeleteThought,
  getThoughtRow,
  listRecentThoughtRows,
  listThoughtRows,
  permanentlyDeleteThought as corePermanentlyDeleteThought,
  removeConnection as coreRemoveConnection,
  restoreThought as coreRestoreThought,
  updateThought as coreUpdateThought,
} from "../core/thought-core";
import { rowToContextDTO } from "./shared";
import type { ReflectaServerContext } from "./types";

export class ThoughtService {
  constructor(private readonly options: ReflectaServerContext) {}

  async assembleThoughtSummaryDTOs(
    thoughtRows: Array<typeof thoughts.$inferSelect>,
  ): Promise<ThoughtSummaryDTO[]> {
    if (thoughtRows.length === 0) return [];

    const db = this.options.getDb();
    const ids = thoughtRows.map((t) => t.id);

    const [tcRows, ctxRows, connRows] = await Promise.all([
      db.select().from(thoughtCategories).where(inArray(thoughtCategories.thoughtId, ids)),
      db
        .select()
        .from(contexts)
        .where(and(inArray(contexts.thoughtId, ids), isNull(contexts.deletedAt))),
      db
        .select()
        .from(thoughtConnections)
        .where(
          or(inArray(thoughtConnections.sourceId, ids), inArray(thoughtConnections.targetId, ids)),
        ),
    ]);

    return thoughtRows.map((t) => ({
      id: t.id,
      type: t.type as ThoughtType,
      title: t.title ?? null,
      body: t.body,
      categoryIds: tcRows.filter((r) => r.thoughtId === t.id).map((r) => r.categoryId),
      contexts: ctxRows.filter((r) => r.thoughtId === t.id).map(rowToContextDTO),
      connections: connRows.filter((r) => r.sourceId === t.id || r.targetId === t.id),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async listThoughts(filter?: ListThoughtsFilter): Promise<ThoughtSummaryDTO[]> {
    const db = this.options.getDb();

    let thoughtRows = await listThoughtRows(db, {
      type: filter?.type,
      categoryId: filter?.categoryId,
      includeDescendants: filter?.includeDescendants,
    });

    if (filter?.searchQuery) {
      const escaped = `"${filter.searchQuery.replace(/"/g, '""')}"*`;
      const ftsRows = await db.all<{ thought_id: string }>(
        sql`SELECT thought_id FROM fts_thoughts WHERE fts_thoughts MATCH ${escaped} ORDER BY rank`,
      );
      const matchingIds = new Set(ftsRows.map((r) => r.thought_id));
      thoughtRows = thoughtRows.filter((t) => matchingIds.has(t.id));
    }

    return this.assembleThoughtSummaryDTOs(thoughtRows);
  }

  async getThoughtById(id: string): Promise<ThoughtDTO | null> {
    const db = this.options.getDb();
    const row = await getThoughtRow(db, id);
    if (!row) return null;

    const [tcRows, ctxRows, connRows, refRows] = await Promise.all([
      db.select().from(thoughtCategories).where(eq(thoughtCategories.thoughtId, id)),
      db
        .select()
        .from(contexts)
        .where(and(eq(contexts.thoughtId, id), isNull(contexts.deletedAt))),
      db.select().from(thoughtConnections).where(eq(thoughtConnections.sourceId, id)),
      db.select().from(thoughtConnections).where(eq(thoughtConnections.targetId, id)),
    ]);

    const connectionIds = connRows.map((r) => r.targetId);
    const connections =
      connectionIds.length > 0
        ? await this.assembleThoughtSummaryDTOs(
            await db.select().from(thoughts).where(inArray(thoughts.id, connectionIds)),
          )
        : [];

    const referencedByIds = refRows.map((r) => r.sourceId);
    const referencedBy =
      referencedByIds.length > 0
        ? await this.assembleThoughtSummaryDTOs(
            await db.select().from(thoughts).where(inArray(thoughts.id, referencedByIds)),
          )
        : [];

    return {
      id: row.id,
      type: row.type as ThoughtType,
      title: row.title ?? null,
      body: row.body,
      categoryIds: tcRows.map((r) => r.categoryId),
      contexts: ctxRows.map(rowToContextDTO),
      connections,
      referencedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createThought(input: CreateThoughtInput): Promise<ThoughtDTO> {
    const db = this.options.getDb();
    const row = await coreCreateThought(db, input);
    const dto = await this.getThoughtById(row.id);
    if (!dto) throw new Error(`Thought not found after creation: ${row.id}`);
    return dto;
  }

  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDTO> {
    const db = this.options.getDb();
    const row = await coreUpdateThought(db, id, input);
    const dto = await this.getThoughtById(row.id);
    if (!dto) throw new Error(`Thought not found after update: ${row.id}`);
    return dto;
  }

  async deleteThought(id: string): Promise<void> {
    await coreDeleteThought(this.options.getDb(), id);
  }

  async restoreThought(id: string): Promise<void> {
    await coreRestoreThought(this.options.getDb(), id);
  }

  async permanentlyDeleteThought(id: string): Promise<void> {
    await corePermanentlyDeleteThought(this.options.getDb(), id);
  }

  async addConnection(sourceId: string, targetId: string): Promise<void> {
    await coreAddConnection(this.options.getDb(), sourceId, targetId);
  }

  async removeConnection(sourceId: string, targetId: string): Promise<void> {
    await coreRemoveConnection(this.options.getDb(), sourceId, targetId);
  }

  async resolveWikiLinkTarget(target: string): Promise<ThoughtSummaryDTO | null> {
    const db = this.options.getDb();
    const normalizedTarget = target.replace(/^\/wiki\//, "").trim();
    if (!normalizedTarget) return null;

    const rows = await db
      .select()
      .from(thoughts)
      .where(
        and(
          isNull(thoughts.deletedAt),
          or(eq(thoughts.id, normalizedTarget), eq(thoughts.title, normalizedTarget)),
        ),
      )
      .orderBy(desc(thoughts.updatedAt))
      .limit(1);

    if (rows.length === 0) return null;
    const [summary] = await this.assembleThoughtSummaryDTOs(rows);
    return summary ?? null;
  }

  async listRecentThoughts(limit = 20): Promise<ThoughtSummaryDTO[]> {
    const rows = await listRecentThoughtRows(this.options.getDb(), limit);
    return this.assembleThoughtSummaryDTOs(rows);
  }
}
