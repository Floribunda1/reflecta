import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { contexts, thoughtCategories, thoughtConnections, thoughts } from "../db/schema";
import type {
  CreateThoughtInput,
  ListThoughtsFilter,
  ThoughtDTO,
  ThoughtSummaryDTO,
  ThoughtType,
  UpdateThoughtInput,
} from "../types";
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
    let thoughtRows: Array<typeof thoughts.$inferSelect>;

    if (filter?.categoryId) {
      let catIds: string[];
      if (filter.includeDescendants) {
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

    return this.assembleThoughtSummaryDTOs(thoughtRows);
  }

  async getThoughtById(id: string): Promise<ThoughtDTO | null> {
    const db = this.options.getDb();
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
    const createdAt = new Date().toISOString();
    const id = nanoid();

    await db.transaction(async (tx) => {
      await tx.insert(thoughts).values({
        id,
        type: input.type,
        title: input.title ?? null,
        body: input.body ?? "",
        createdAt,
        updatedAt: createdAt,
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
    if (!dto) throw new Error(`Thought not found after creation: ${id}`);
    return dto;
  }

  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDTO> {
    const db = this.options.getDb();
    const updates: Partial<typeof thoughts.$inferInsert> = { updatedAt: new Date().toISOString() };
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
    if (!dto) throw new Error(`Thought not found after update: ${id}`);
    return dto;
  }

  async deleteThought(id: string): Promise<void> {
    const db = this.options.getDb();
    await db.transaction(async (tx) => {
      await tx
        .update(thoughts)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(thoughts.id, id));
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
    });
  }

  async restoreThought(id: string): Promise<void> {
    const db = this.options.getDb();
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(thoughts)
        .set({ deletedAt: null })
        .where(and(eq(thoughts.id, id), isNotNull(thoughts.deletedAt)))
        .returning();
      if (rows.length === 0) return;
      const row = rows[0];
      await tx.run(
        sql`INSERT OR IGNORE INTO fts_thoughts (thought_id, title, body) VALUES (${row.id}, ${row.title ?? ""}, ${row.body})`,
      );
      const ctxRows = await tx
        .select()
        .from(contexts)
        .where(and(eq(contexts.thoughtId, id), isNull(contexts.deletedAt)));
      for (const ctx of ctxRows) {
        await tx.run(
          sql`INSERT OR IGNORE INTO fts_contexts (context_id, thought_id, source_name, content) VALUES (${ctx.id}, ${ctx.thoughtId}, ${ctx.sourceName}, ${ctx.content})`,
        );
      }
    });
  }

  async permanentlyDeleteThought(id: string): Promise<void> {
    const db = this.options.getDb();
    await db.transaction(async (tx) => {
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
      await tx.delete(thoughts).where(eq(thoughts.id, id));
    });
  }

  async addConnection(sourceId: string, targetId: string): Promise<void> {
    const db = this.options.getDb();
    await db.insert(thoughtConnections).values({ sourceId, targetId }).onConflictDoNothing();
  }

  async removeConnection(sourceId: string, targetId: string): Promise<void> {
    const db = this.options.getDb();
    await db
      .delete(thoughtConnections)
      .where(
        and(eq(thoughtConnections.sourceId, sourceId), eq(thoughtConnections.targetId, targetId)),
      );
  }

  async listRecentThoughts(limit = 20): Promise<ThoughtSummaryDTO[]> {
    const db = this.options.getDb();
    const rows = await db
      .select()
      .from(thoughts)
      .where(isNull(thoughts.deletedAt))
      .orderBy(desc(thoughts.updatedAt))
      .limit(limit);
    return this.assembleThoughtSummaryDTOs(rows);
  }
}
