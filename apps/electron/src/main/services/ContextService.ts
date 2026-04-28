import { getDBInstance } from "@main/db";
import { contexts } from "@main/db/schema";
import type {
  ContextDTO,
  CreateContextInput,
  SourceType,
  UpdateContextInput,
} from "@shared/context";
import type { TrashedContextDTO } from "@shared/trash";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { nanoid } from "nanoid";

export type { ContextDTO, CreateContextInput, SourceType, UpdateContextInput };

function toDTO(row: typeof contexts.$inferSelect): ContextDTO {
  return {
    id: row.id,
    thoughtId: row.thoughtId,
    sourceType: row.sourceType as SourceType,
    sourceName: row.sourceName ?? null,
    content: row.content,
    createdAt: row.createdAt,
  };
}

export class ContextService extends IpcService {
  static readonly groupName = "context";

  @IpcMethod()
  async listContextsByThought(thoughtId: string): Promise<ContextDTO[]> {
    const db = getDBInstance();
    const rows = await db
      .select()
      .from(contexts)
      .where(and(eq(contexts.thoughtId, thoughtId), isNull(contexts.deletedAt)));
    return rows.map(toDTO);
  }

  @IpcMethod()
  async createContext(input: CreateContextInput): Promise<ContextDTO> {
    const db = getDBInstance();
    const now = new Date().toISOString();
    const id = nanoid();
    const row = {
      id,
      thoughtId: input.thoughtId,
      sourceType: input.sourceType,
      sourceName: input.sourceName ?? null,
      content: input.content,
      createdAt: now,
      deletedAt: null,
    };

    await db.transaction(async (tx) => {
      await tx.insert(contexts).values(row);
      await tx.run(sql`
				INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
				VALUES (${id}, ${input.thoughtId}, ${input.sourceName ?? null}, ${input.content})
			`);
    });

    return toDTO(row);
  }

  @IpcMethod()
  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    const db = getDBInstance();
    const updates: Partial<typeof contexts.$inferInsert> = {};
    if (input.sourceType !== undefined) updates.sourceType = input.sourceType;
    if (input.sourceName !== undefined) updates.sourceName = input.sourceName;
    if (input.content !== undefined) updates.content = input.content;

    let updated!: typeof contexts.$inferSelect;
    await db.transaction(async (tx) => {
      const rows = await tx.update(contexts).set(updates).where(eq(contexts.id, id)).returning();
      if (rows.length === 0) throw new Error(`Context not found: ${id}`);
      updated = rows[0];

      await tx.run(sql`DELETE FROM fts_contexts WHERE context_id = ${id}`);
      await tx.run(sql`
				INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
				VALUES (${updated.id}, ${updated.thoughtId}, ${updated.sourceName}, ${updated.content})
			`);
    });

    return toDTO(updated);
  }

  /** Move a context to the trash (soft delete). Removes it from FTS. */
  @IpcMethod()
  async deleteContext(id: string): Promise<void> {
    const db = getDBInstance();
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.update(contexts).set({ deletedAt: now }).where(eq(contexts.id, id));
      await tx.run(sql`DELETE FROM fts_contexts WHERE context_id = ${id}`);
    });
  }

  /** Restore a soft-deleted context. Re-indexes it in FTS. */
  @IpcMethod()
  async restoreContext(id: string): Promise<void> {
    const db = getDBInstance();
    await db.transaction(async (tx) => {
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

  /** Permanently delete a context from the trash. Cannot be undone. */
  @IpcMethod()
  async permanentlyDeleteContext(id: string): Promise<void> {
    const db = getDBInstance();
    await db.transaction(async (tx) => {
      await tx.delete(contexts).where(eq(contexts.id, id));
      await tx.run(sql`DELETE FROM fts_contexts WHERE context_id = ${id}`);
    });
  }

  /** List all trashed contexts whose parent thought is still active. */
  @IpcMethod()
  async listTrashedContexts(): Promise<TrashedContextDTO[]> {
    const db = getDBInstance();
    const rows = await db.all<{
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
      sourceType: r.source_type as TrashedContextDTO["sourceType"],
      sourceName: r.source_name ?? null,
      content: r.content,
      deletedAt: r.deleted_at,
    }));
  }
}
