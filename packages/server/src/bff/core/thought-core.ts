import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import { extractThoughtWikiLinkTargets, normalizeThoughtWikiLinkBody } from "../../wiki-links";
import { getCategoryDescendants } from "./shared";
import type { ReflectaDb } from "../../db/types";
import type { CreateThoughtInput, ListThoughtsFilter, UpdateThoughtInput } from "../../types";

export async function listThoughtRows(
  db: ReflectaDb,
  filter?: ListThoughtsFilter & { limit?: number; offset?: number },
): Promise<Array<typeof thoughts.$inferSelect>> {
  const conditions = [isNull(thoughts.deletedAt)];

  if (filter?.type) {
    conditions.push(eq(thoughts.type, filter.type));
  }

  if (filter?.categoryId) {
    let catIds = [filter.categoryId];
    if (filter.includeDescendants) {
      const descendants = await getCategoryDescendants(db, filter.categoryId);
      catIds = [...catIds, ...descendants];
    }
    conditions.push(
      inArray(
        thoughts.id,
        db
          .select({ id: thoughtCategories.thoughtId })
          .from(thoughtCategories)
          .where(inArray(thoughtCategories.categoryId, catIds)),
      ),
    );
  }

  let query = db
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

export async function listRecentThoughtRows(
  db: ReflectaDb,
  limit = 20,
): Promise<Array<typeof thoughts.$inferSelect>> {
  return db
    .select()
    .from(thoughts)
    .where(isNull(thoughts.deletedAt))
    .orderBy(desc(thoughts.updatedAt))
    .limit(limit);
}

export async function getThoughtRow(
  db: ReflectaDb,
  id: string,
): Promise<typeof thoughts.$inferSelect | null> {
  const rows = await db
    .select()
    .from(thoughts)
    .where(and(eq(thoughts.id, id), isNull(thoughts.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createThought(
  db: ReflectaDb,
  input: CreateThoughtInput,
): Promise<typeof thoughts.$inferSelect> {
  const createdAt = new Date().toISOString();
  const id = nanoid();
  const body = normalizeThoughtWikiLinkBody(input.body) ?? "";

  await db.transaction(async (tx) => {
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

  await syncWikiLinkConnections(db, id, body);

  const row = await getThoughtRow(db, id);
  if (!row) throw new Error(`Thought not found after creation: ${id}`);
  return row;
}

export async function updateThought(
  db: ReflectaDb,
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

  await db.transaction(async (tx) => {
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
    await syncWikiLinkConnections(db, id, normalizedBody);
  }

  const row = await getThoughtRow(db, id);
  if (!row) throw new Error(`Thought not found after update: ${id}`);
  return row;
}

export async function deleteThought(db: ReflectaDb, id: string): Promise<void> {
  await db.transaction(async (tx) => {
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

export async function restoreThought(db: ReflectaDb, id: string): Promise<void> {
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
  });
}

export async function permanentlyDeleteThought(db: ReflectaDb, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
    await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
    await tx.delete(thoughts).where(eq(thoughts.id, id));
  });
}

export async function addConnection(
  db: ReflectaDb,
  sourceId: string,
  targetId: string,
): Promise<void> {
  await db.insert(thoughtConnections).values({ sourceId, targetId }).onConflictDoNothing();
}

export async function removeConnection(
  db: ReflectaDb,
  sourceId: string,
  targetId: string,
): Promise<void> {
  await db
    .delete(thoughtConnections)
    .where(
      and(eq(thoughtConnections.sourceId, sourceId), eq(thoughtConnections.targetId, targetId)),
    );
}

export async function syncWikiLinkConnections(
  db: ReflectaDb,
  sourceId: string,
  body: string,
): Promise<void> {
  const linkTargets = extractThoughtWikiLinkTargets(body);

  await db.transaction(async (tx) => {
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
