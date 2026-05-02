import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { contexts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { ContextDTO, CreateContextInput, SourceType, UpdateContextInput } from "./types";
import type { TrashedContextDTO } from "../trash/types";

export class ContextCore {
  constructor(protected db: ReflectaDb) {}

  async listContextsByThought(thoughtId: string): Promise<ContextDTO[]> {
    const rows = await this.db
      .select()
      .from(contexts)
      .where(and(eq(contexts.thoughtId, thoughtId), isNull(contexts.deletedAt)))
      .orderBy(desc(contexts.createdAt));
    return rows as ContextDTO[];
  }

  async getContextRow(id: string): Promise<typeof contexts.$inferSelect | null> {
    const rows = await this.db
      .select()
      .from(contexts)
      .where(and(eq(contexts.id, id), isNull(contexts.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async _createContext(input: CreateContextInput): Promise<ContextDTO> {
    const createdAt = new Date().toISOString();
    const id = nanoid();

    const row: typeof contexts.$inferInsert = {
      id,
      thoughtId: input.thoughtId,
      sourceType: input.sourceType,
      sourceName: input.sourceName ?? null,
      content: input.content,
      createdAt,
      deletedAt: null,
    };

    await this.db.transaction(async (tx) => {
      await tx.insert(contexts).values(row);
      await tx.run(sql`
        INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
        VALUES (${id}, ${input.thoughtId}, ${input.sourceName ?? null}, ${input.content})
      `);
    });

    return { ...row, createdAt, deletedAt: null } as ContextDTO;
  }

  async _updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    const updates: Partial<typeof contexts.$inferInsert> = {};
    if (input.sourceType !== undefined) updates.sourceType = input.sourceType;
    if (input.sourceName !== undefined) updates.sourceName = input.sourceName;
    if (input.content !== undefined) updates.content = input.content;

    let updated: ContextDTO | undefined;
    await this.db.transaction(async (tx) => {
      const rows = await tx.update(contexts).set(updates).where(eq(contexts.id, id)).returning();
      if (rows.length === 0) {
        throw new Error(`Context not found: ${id}`);
      }
      updated = rows[0] as ContextDTO;

      await tx.run(sql`DELETE FROM fts_contexts WHERE context_id = ${id}`);
      await tx.run(sql`
        INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
        VALUES (${updated.id}, ${updated.thoughtId}, ${updated.sourceName}, ${updated.content})
      `);
    });

    return updated!;
  }

  async deleteContext(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(contexts)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(contexts.id, id))
        .returning();
      if (rows.length === 0) {
        throw new Error(`Context not found: ${id}`);
      }
      await tx.run(sql`DELETE FROM fts_contexts WHERE context_id = ${id}`);
    });
  }

  async restoreContext(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(contexts)
        .set({ deletedAt: null })
        .where(and(eq(contexts.id, id), isNotNull(contexts.deletedAt)))
        .returning();
      if (rows.length === 0) return;
      const ctx = rows[0];
      await tx.run(
        sql`INSERT INTO fts_contexts (context_id, thought_id, source_name, content) VALUES (${ctx.id}, ${ctx.thoughtId}, ${ctx.sourceName}, ${ctx.content})`,
      );
    });
  }

  async permanentlyDeleteContext(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(contexts).where(eq(contexts.id, id));
      await tx.run(sql`DELETE FROM fts_contexts WHERE context_id = ${id}`);
    });
  }

  async listTrashedContexts(): Promise<TrashedContextDTO[]> {
    const rows = await this.db.all<{
      id: string;
      thought_id: string;
      thought_title: string | null;
      source_type: string;
      source_name: string | null;
      content: string;
      deleted_at: string;
    }>(sql`
      SELECT
        c.id,
        c.thought_id,
        t.title AS thought_title,
        c.source_type,
        c.source_name,
        c.content,
        c.deleted_at
      FROM contexts c
      JOIN thoughts t ON t.id = c.thought_id
      WHERE c.deleted_at IS NOT NULL
        AND t.deleted_at IS NULL
      ORDER BY c.deleted_at DESC
    `);

    return rows.map((r) => ({
      id: r.id,
      thoughtId: r.thought_id,
      thoughtTitle: r.thought_title ?? null,
      sourceType: r.source_type as SourceType,
      sourceName: r.source_name ?? null,
      content: r.content,
      deletedAt: r.deleted_at,
    }));
  }
}
