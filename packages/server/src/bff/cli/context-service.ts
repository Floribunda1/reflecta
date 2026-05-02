import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { contexts } from "../../db/schema";
import type { ReflectaDb } from "../electron/types";
import type { ContextDetail, CreateContextInput, SourceType, UpdateContextInput } from "./types";

export class ContextService {
  constructor(private db: ReflectaDb) {}

  async listContexts(thoughtId: string): Promise<ContextDetail[]> {
    const rows = await this.db
      .select()
      .from(contexts)
      .where(and(eq(contexts.thoughtId, thoughtId), isNull(contexts.deletedAt)))
      .orderBy(desc(contexts.createdAt));

    return rows.map((r) => ({
      id: r.id,
      thoughtId: r.thoughtId,
      sourceType: r.sourceType as SourceType,
      sourceName: r.sourceName ?? null,
      content: r.content,
    }));
  }

  async getContext(id: string): Promise<ContextDetail> {
    const rows = await this.db
      .select()
      .from(contexts)
      .where(and(eq(contexts.id, id), isNull(contexts.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Context not found: ${id}`);
    }

    const r = rows[0];
    return {
      id: r.id,
      thoughtId: r.thoughtId,
      sourceType: r.sourceType as SourceType,
      sourceName: r.sourceName ?? null,
      content: r.content,
    };
  }

  async createContext(input: CreateContextInput): Promise<ContextDetail> {
    const createdAt = new Date().toISOString();
    const id = nanoid();

    await this.db.transaction(async (tx) => {
      await tx.insert(contexts).values({
        id,
        thoughtId: input.thoughtId,
        sourceType: input.sourceType,
        sourceName: input.sourceName ?? null,
        content: input.content,
        createdAt,
        deletedAt: null,
      });

      await tx.run(sql`
        INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
        VALUES (${id}, ${input.thoughtId}, ${input.sourceName ?? null}, ${input.content})
      `);
    });

    return this.getContext(id);
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDetail> {
    const updates: Partial<typeof contexts.$inferInsert> = {};
    if (input.sourceType !== undefined) updates.sourceType = input.sourceType;
    if (input.sourceName !== undefined) updates.sourceName = input.sourceName;
    if (input.content !== undefined) updates.content = input.content;

    await this.db.transaction(async (tx) => {
      const rows = await tx.update(contexts).set(updates).where(eq(contexts.id, id)).returning();
      if (rows.length === 0) {
        throw new Error(`Context not found: ${id}`);
      }
      const updated = rows[0];

      await tx.run(sql`DELETE FROM fts_contexts WHERE context_id = ${id}`);
      await tx.run(sql`
        INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
        VALUES (${updated.id}, ${updated.thoughtId}, ${updated.sourceName}, ${updated.content})
      `);
    });

    return this.getContext(id);
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
}
