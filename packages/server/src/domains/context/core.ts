import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { contexts, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { ContextDTO, CreateContextInput, ContextMedium, UpdateContextInput } from "./types";
import type { TrashedContextDTO } from "../trash/types";
import { createEntityId } from "../shared/id";

export class ContextCore {
  constructor(protected db: ReflectaDb) {}

  async listContextsByUnderstanding(understandingId: string): Promise<ContextDTO[]> {
    const rows = await this.db
      .select()
      .from(contexts)
      .where(and(eq(contexts.understandingId, understandingId), isNull(contexts.deletedAt)))
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
    const id = createEntityId();
    await this.assertUnderstandingExists(input.understandingId);

    const row: typeof contexts.$inferInsert = {
      id,
      understandingId: input.understandingId,
      medium: input.medium,
      title: input.title ?? null,
      content: input.content,
      createdAt,
      deletedAt: null,
    };

    await this.db.insert(contexts).values(row).run();
    return { ...row, createdAt, deletedAt: null } as ContextDTO;
  }

  async _updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    const updates: Partial<typeof contexts.$inferInsert> = {};
    if (input.understandingId !== undefined) {
      await this.assertUnderstandingExists(input.understandingId);
      updates.understandingId = input.understandingId;
    }
    if (input.medium !== undefined) updates.medium = input.medium;
    if (input.title !== undefined) updates.title = input.title;
    if (input.content !== undefined) updates.content = input.content;
    if (Object.keys(updates).length === 0) throw new Error("No context fields to update");

    let updated: ContextDTO | undefined;
    await this.db.transaction((tx) => {
      const rows = tx.update(contexts).set(updates).where(eq(contexts.id, id)).returning().all();
      if (rows.length === 0) {
        throw new Error(`Context not found: ${id}`);
      }
      updated = rows[0] as ContextDTO;
    });

    return updated!;
  }

  async deleteContext(id: string): Promise<void> {
    await this.db.transaction((tx) => {
      const rows = tx
        .update(contexts)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(contexts.id, id))
        .returning()
        .all();
      if (rows.length === 0) {
        throw new Error(`Context not found: ${id}`);
      }
    });
  }

  async restoreContext(id: string): Promise<void> {
    await this.db.transaction((tx) => {
      const rows = tx
        .update(contexts)
        .set({ deletedAt: null })
        .where(and(eq(contexts.id, id), isNotNull(contexts.deletedAt)))
        .returning()
        .all();
      if (rows.length === 0) return;
    });
  }

  async permanentlyDeleteContext(id: string): Promise<void> {
    await this.db.delete(contexts).where(eq(contexts.id, id)).run();
  }

  private async assertUnderstandingExists(understandingId: string): Promise<void> {
    const rows = await this.db
      .select({ id: understandings.id })
      .from(understandings)
      .where(and(eq(understandings.id, understandingId), isNull(understandings.deletedAt)))
      .limit(1);
    if (rows.length === 0) throw new Error(`Understanding not found: ${understandingId}`);
  }

  async listTrashedContexts(): Promise<TrashedContextDTO[]> {
    const rows = await this.db.all<{
      id: string;
      understanding_id: string;
      understanding_title: string | null;
      medium: string;
      title: string | null;
      content: string;
      deleted_at: string;
    }>(sql`
      SELECT
        c.id,
        c.understanding_id,
        t.title AS understanding_title,
        c.medium,
        c.title,
        c.content,
        c.deleted_at
      FROM contexts c
      JOIN understandings t ON t.id = c.understanding_id
      WHERE c.deleted_at IS NOT NULL
        AND t.deleted_at IS NULL
      ORDER BY c.deleted_at DESC
    `);

    return rows.map((r) => ({
      id: r.id,
      understandingId: r.understanding_id,
      understandingTitle: r.understanding_title ?? null,
      medium: r.medium as ContextMedium,
      title: r.title ?? null,
      content: r.content,
      deletedAt: r.deleted_at,
    }));
  }
}
