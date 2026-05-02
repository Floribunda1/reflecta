import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import { extractThoughtWikiLinkTargets, normalizeThoughtWikiLinkBody } from "../../wiki-links";
import { getCategoryDescendants } from "../shared/core";
import type { ReflectaDb } from "../../db/types";
import type { CreateThoughtInput, ListThoughtsFilter, UpdateThoughtInput } from "./types";

export class ThoughtCore {
  constructor(protected db: ReflectaDb) {}

  async listThoughtRows(
    filter?: ListThoughtsFilter & { limit?: number; offset?: number },
  ): Promise<Array<typeof thoughts.$inferSelect>> {
    const conditions = [isNull(thoughts.deletedAt)];

    if (filter?.type) {
      conditions.push(eq(thoughts.type, filter.type));
    }

    if (filter?.categoryId) {
      let catIds = [filter.categoryId];
      if (filter.includeDescendants) {
        const descendants = await getCategoryDescendants(this.db, filter.categoryId);
        catIds = [...catIds, ...descendants];
      }
      conditions.push(
        inArray(
          thoughts.id,
          this.db
            .select({ id: thoughtCategories.thoughtId })
            .from(thoughtCategories)
            .where(inArray(thoughtCategories.categoryId, catIds)),
        ),
      );
    }

    let query = this.db
      .select()
      .from(thoughts)
      .where(and(...conditions))
      .orderBy(desc(thoughts.updatedAt))
      .$dynamic();

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit);
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset);
    }

    return query;
  }

  async listRecentThoughtRows(limit = 20): Promise<Array<typeof thoughts.$inferSelect>> {
    return this.db
      .select()
      .from(thoughts)
      .where(isNull(thoughts.deletedAt))
      .orderBy(desc(thoughts.updatedAt))
      .limit(limit);
  }

  async getThoughtRow(id: string): Promise<typeof thoughts.$inferSelect | null> {
    const rows = await this.db
      .select()
      .from(thoughts)
      .where(and(eq(thoughts.id, id), isNull(thoughts.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async _createThought(input: CreateThoughtInput): Promise<typeof thoughts.$inferSelect> {
    const createdAt = new Date().toISOString();
    const id = nanoid();
    const body = normalizeThoughtWikiLinkBody(input.body) ?? "";

    await this.db.transaction(async (tx) => {
      await tx.insert(thoughts).values({
        id,
        type: input.type,
        title: input.title ?? null,
        body,
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
        sql`INSERT INTO fts_thoughts (thought_id, title, body) VALUES (${id}, ${input.title ?? ""}, ${body})`,
      );
    });

    await this.syncWikiLinkConnections(id, body);

    const row = await this.getThoughtRow(id);
    if (!row) throw new Error(`Thought not found after creation: ${id}`);
    return row;
  }

  async _updateThought(
    id: string,
    input: UpdateThoughtInput,
  ): Promise<typeof thoughts.$inferSelect> {
    const updates: Partial<typeof thoughts.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.type !== undefined) updates.type = input.type;
    const normalizedBody = normalizeThoughtWikiLinkBody(input.body);
    if (normalizedBody !== undefined) updates.body = normalizedBody;
    if (input.title !== undefined) updates.title = input.title;

    await this.db.transaction(async (tx) => {
      const rows = await tx.update(thoughts).set(updates).where(eq(thoughts.id, id)).returning();
      if (rows.length === 0) {
        throw new Error(`Thought not found: ${id}`);
      }

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

    if (normalizedBody !== undefined) {
      await this.syncWikiLinkConnections(id, normalizedBody);
    }

    const row = await this.getThoughtRow(id);
    if (!row) throw new Error(`Thought not found after update: ${id}`);
    return row;
  }

  async deleteThought(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(thoughts)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(thoughts.id, id))
        .returning();
      if (rows.length === 0) {
        throw new Error(`Thought not found: ${id}`);
      }
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
    });
  }

  async restoreThought(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
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
    });
  }

  async permanentlyDeleteThought(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
      await tx.delete(thoughts).where(eq(thoughts.id, id));
    });
  }

  async syncWikiLinkConnections(sourceId: string, body: string): Promise<void> {
    const linkTargets = extractThoughtWikiLinkTargets(body);

    await this.db.transaction(async (tx) => {
      await tx.delete(thoughtConnections).where(eq(thoughtConnections.sourceId, sourceId));

      if (linkTargets.length === 0) return;

      const rows = await tx
        .select()
        .from(thoughts)
        .where(
          and(
            isNull(thoughts.deletedAt),
            or(inArray(thoughts.id, linkTargets), inArray(thoughts.title, linkTargets)),
          ),
        )
        .orderBy(desc(thoughts.updatedAt));

      const targetIds = new Set<string>();
      for (const target of linkTargets) {
        const row = rows.find((t) => t.id === target) ?? rows.find((t) => t.title === target);
        if (row && row.id !== sourceId) targetIds.add(row.id);
      }

      if (targetIds.size === 0) return;
      await tx
        .insert(thoughtConnections)
        .values([...targetIds].map((targetId) => ({ sourceId, targetId })))
        .onConflictDoNothing();
    });
  }
}
