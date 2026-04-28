import { getDBInstance } from "@main/db";
import { contexts, thoughtCategories, thoughtConnections, thoughts } from "@main/db/schema";
import type { ContextDTO, SourceType } from "@shared/context";
import type {
  CreateThoughtInput,
  ListThoughtsFilter,
  ThoughtDTO,
  ThoughtSummaryDTO,
  ThoughtType,
  UpdateThoughtInput,
} from "@shared/thought";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { nanoid } from "nanoid";

export type {
  CreateThoughtInput,
  ListThoughtsFilter,
  ThoughtDTO,
  ThoughtSummaryDTO,
  ThoughtType,
  UpdateThoughtInput,
};

function rowToContextDTO(row: typeof contexts.$inferSelect): ContextDTO {
  return {
    id: row.id,
    thoughtId: row.thoughtId,
    sourceType: row.sourceType as SourceType,
    sourceName: row.sourceName ?? null,
    content: row.content,
    createdAt: row.createdAt,
  };
}

/** Shared helper for assembling lightweight ThoughtSummaryDTOs. Used by list methods and SearchService. */
export async function assembleThoughtSummaryDTOs(
  thoughtRows: Array<typeof thoughts.$inferSelect>,
): Promise<ThoughtSummaryDTO[]> {
  if (thoughtRows.length === 0) return [];

  const db = getDBInstance();
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

export class ThoughtService extends IpcService {
  static readonly groupName = "thought";

  @IpcMethod()
  async listThoughts(filter?: ListThoughtsFilter): Promise<ThoughtSummaryDTO[]> {
    const db = getDBInstance();
    let thoughtRows: Array<typeof thoughts.$inferSelect>;

    if (filter?.categoryId) {
      let catIds: string[];
      if (filter.includeDescendants) {
        // Recursive CTE to collect all descendant category IDs
        const result = await db.all<{ id: string }>(sql`
					WITH RECURSIVE descendants(id) AS (
						SELECT id FROM categories WHERE id = ${filter.categoryId}
						UNION ALL
						SELECT c.id FROM categories c
						INNER JOIN descendants d ON c.parent_id = d.id
					)
					SELECT id FROM descendants
				`);
        catIds = result.map((r) => r.id);
      } else {
        catIds = [filter.categoryId];
      }

      thoughtRows = await db
        .select()
        .from(thoughts)
        .where(
          and(
            isNull(thoughts.deletedAt),
            inArray(
              thoughts.id,
              db
                .select({ id: thoughtCategories.thoughtId })
                .from(thoughtCategories)
                .where(inArray(thoughtCategories.categoryId, catIds)),
            ),
          ),
        );
    } else {
      thoughtRows = await db.select().from(thoughts).where(isNull(thoughts.deletedAt));
    }

    if (filter?.type) {
      thoughtRows = thoughtRows.filter((t) => t.type === filter.type);
    }

    if (filter?.searchQuery) {
      const term = `${filter.searchQuery}*`;
      const ftsRows = await db.all<{ thought_id: string }>(
        sql`SELECT thought_id FROM fts_thoughts WHERE fts_thoughts MATCH ${term} ORDER BY rank`,
      );
      const matchingIds = new Set(ftsRows.map((r) => r.thought_id));
      thoughtRows = thoughtRows.filter((t) => matchingIds.has(t.id));
    }

    return assembleThoughtSummaryDTOs(thoughtRows);
  }

  @IpcMethod()
  async getThoughtById(id: string): Promise<ThoughtDTO | null> {
    const db = getDBInstance();
    const rows = await db
      .select()
      .from(thoughts)
      .where(and(eq(thoughts.id, id), isNull(thoughts.deletedAt)))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];

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
    let connections: ThoughtSummaryDTO[] = [];
    if (connectionIds.length > 0) {
      const connThoughtRows = await db
        .select()
        .from(thoughts)
        .where(inArray(thoughts.id, connectionIds));
      connections = await assembleThoughtSummaryDTOs(connThoughtRows);
    }

    const referencedByIds = refRows.map((r) => r.sourceId);
    let referencedBy: ThoughtSummaryDTO[] = [];
    if (referencedByIds.length > 0) {
      const refThoughtRows = await db
        .select()
        .from(thoughts)
        .where(inArray(thoughts.id, referencedByIds));
      referencedBy = await assembleThoughtSummaryDTOs(refThoughtRows);
    }

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

  @IpcMethod()
  async createThought(input: CreateThoughtInput): Promise<ThoughtDTO> {
    const db = getDBInstance();
    const now = new Date().toISOString();
    const id = nanoid();

    await db.transaction(async (tx) => {
      await tx.insert(thoughts).values({
        id,
        type: input.type,
        title: input.title ?? null,
        body: input.body ?? "",
        createdAt: now,
        updatedAt: now,
      });

      if (input.categoryIds && input.categoryIds.length > 0) {
        await tx.insert(thoughtCategories).values(
          input.categoryIds.map((catId) => ({
            thoughtId: id,
            categoryId: catId,
          })),
        );
      }

      await tx.run(
        sql`INSERT INTO fts_thoughts (thought_id, title, body) VALUES (${id}, ${input.title ?? ""}, ${input.body ?? ""})`,
      );
    });

    const dto = await this.getThoughtById(id);
    return dto!;
  }

  /**
   * Update body and/or categories atomically.
   * Passing `categoryIds` replaces the full category set.
   */
  @IpcMethod()
  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDTO> {
    const db = getDBInstance();
    const now = new Date().toISOString();
    const updates: Partial<typeof thoughts.$inferInsert> = { updatedAt: now };
    if (input.type !== undefined) updates.type = input.type;
    if (input.body !== undefined) updates.body = input.body;
    if (input.title !== undefined) updates.title = input.title;

    await db.transaction(async (tx) => {
      const rows = await tx.update(thoughts).set(updates).where(eq(thoughts.id, id)).returning();
      if (rows.length === 0) throw new Error(`Thought not found: ${id}`);

      if (input.body !== undefined || input.title !== undefined) {
        const row = rows[0];
        await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
        await tx.run(
          sql`INSERT INTO fts_thoughts (thought_id, title, body) VALUES (${id}, ${row.title ?? ""}, ${row.body})`,
        );
      }

      if (input.categoryIds !== undefined) {
        // Hard-delete old assignments; this is a user-driven operation, not a soft delete
        await tx.delete(thoughtCategories).where(eq(thoughtCategories.thoughtId, id));
        if (input.categoryIds.length > 0) {
          await tx.insert(thoughtCategories).values(
            input.categoryIds.map((catId) => ({
              thoughtId: id,
              categoryId: catId,
            })),
          );
        }
      }
    });

    const dto = await this.getThoughtById(id);
    return dto!;
  }

  /** Move a thought to the trash (soft delete). Removes from FTS so it won't appear in search. */
  @IpcMethod()
  async deleteThought(id: string): Promise<void> {
    const db = getDBInstance();
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.update(thoughts).set({ deletedAt: now }).where(eq(thoughts.id, id));
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
    });
  }

  /** Restore a soft-deleted thought back from the trash. Re-indexes it in FTS. */
  @IpcMethod()
  async restoreThought(id: string): Promise<void> {
    const db = getDBInstance();
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(thoughts)
        .set({ deletedAt: null })
        .where(and(eq(thoughts.id, id), isNotNull(thoughts.deletedAt)))
        .returning();
      if (rows.length === 0) return;
      const row = rows[0];
      await tx.run(
        sql`INSERT INTO fts_thoughts (thought_id, title, body) VALUES (${row.id}, ${row.title ?? ""}, ${row.body})`,
      );
      // Re-index non-deleted contexts that belong to this thought
      const ctxRows = await tx
        .select()
        .from(contexts)
        .where(and(eq(contexts.thoughtId, id), isNull(contexts.deletedAt)));
      for (const ctx of ctxRows) {
        await tx.run(
          sql`INSERT INTO fts_contexts (context_id, thought_id, source_name, content) VALUES (${ctx.id}, ${ctx.thoughtId}, ${ctx.sourceName}, ${ctx.content})`,
        );
      }
    });
  }

  /** Permanently delete a thought and all its associated records. Cannot be undone. */
  @IpcMethod()
  async permanentlyDeleteThought(id: string): Promise<void> {
    const db = getDBInstance();
    await db.transaction(async (tx) => {
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
      // ON DELETE CASCADE handles thought_categories, thought_connections, contexts
      await tx.delete(thoughts).where(eq(thoughts.id, id));
    });
  }

  /** Create a directed connection from sourceId → targetId. */
  @IpcMethod()
  async addConnection(sourceId: string, targetId: string): Promise<void> {
    const db = getDBInstance();
    await db.insert(thoughtConnections).values({ sourceId, targetId }).onConflictDoNothing();
  }

  /** Remove the directed connection sourceId → targetId. */
  @IpcMethod()
  async removeConnection(sourceId: string, targetId: string): Promise<void> {
    const db = getDBInstance();
    await db
      .delete(thoughtConnections)
      .where(
        and(eq(thoughtConnections.sourceId, sourceId), eq(thoughtConnections.targetId, targetId)),
      );
  }
}
