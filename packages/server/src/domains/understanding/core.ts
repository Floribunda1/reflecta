import { and, desc, eq, inArray, isNotNull, isNull, or, count } from "drizzle-orm";
import {
  domains,
  contexts,
  understandingDomains,
  understandingConnections,
  understandings,
} from "../../db/schema";
import {
  extractUnderstandingWikiLinkTargets,
  normalizeUnderstandingWikiLinkBody,
} from "./wiki-links";
import { getDomainDescendants } from "../domain/core";
import type { ReflectaDb } from "../../db/types";
import type {
  CreateUnderstandingInput,
  ListUnderstandingsFilter,
  UnderstandingSummary,
  UpdateUnderstandingInput,
} from "./types";
import { resolveDomainRefs } from "../domain/core";
import { markRetrievalIndexDirty, trySyncRetrievalIndexByUnderstandingId } from "../retrieval/sync";
import { createEntityId } from "../shared/id";

export async function getUnderstandingConnectionCounts(
  db: ReflectaDb,
  understandingId: string,
): Promise<{ contextCount: number; referenceCount: number; referencedByCount: number }> {
  const [ctxCountRes, refCountRes, refByCountRes] = await Promise.all([
    db
      .select({ count: count() })
      .from(contexts)
      .where(and(eq(contexts.understandingId, understandingId), isNull(contexts.deletedAt))),
    db
      .select({ count: count() })
      .from(understandingConnections)
      .where(eq(understandingConnections.sourceId, understandingId)),
    db
      .select({ count: count() })
      .from(understandingConnections)
      .where(eq(understandingConnections.targetId, understandingId)),
  ]);

  return {
    contextCount: ctxCountRes[0]?.count ?? 0,
    referenceCount: refCountRes[0]?.count ?? 0,
    referencedByCount: refByCountRes[0]?.count ?? 0,
  };
}

export class UnderstandingCore {
  constructor(protected db: ReflectaDb) {}

  async listUnderstandingRows(
    filter?: ListUnderstandingsFilter & { limit?: number; offset?: number },
  ): Promise<Array<typeof understandings.$inferSelect>> {
    const conditions = [isNull(understandings.deletedAt)];

    if (filter?.domainIds && filter.domainIds.length > 0) {
      const domainIds = filter.domainIds;
      let catIds = domainIds;
      if (filter?.includeDescendants) {
        const allDescendants: string[] = [];
        for (const catId of domainIds) {
          const descendants = await getDomainDescendants(this.db, catId);
          allDescendants.push(...descendants);
        }
        catIds = [...new Set([...catIds, ...allDescendants])];
      }
      conditions.push(
        inArray(
          understandings.id,
          this.db
            .select({ id: understandingDomains.understandingId })
            .from(understandingDomains)
            .where(inArray(understandingDomains.domainId, catIds)),
        ),
      );
    }

    let query = this.db
      .select()
      .from(understandings)
      .where(and(...conditions))
      .orderBy(desc(understandings.updatedAt))
      .$dynamic();

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit);
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset);
    }

    return query;
  }

  async listRecentUnderstandingRows(
    limit = 20,
  ): Promise<Array<typeof understandings.$inferSelect>> {
    return this.db
      .select()
      .from(understandings)
      .where(isNull(understandings.deletedAt))
      .orderBy(desc(understandings.updatedAt))
      .limit(limit);
  }

  async getUnderstandingRow(id: string): Promise<typeof understandings.$inferSelect | null> {
    const rows = await this.db
      .select()
      .from(understandings)
      .where(and(eq(understandings.id, id), isNull(understandings.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async _createUnderstanding(
    input: CreateUnderstandingInput,
  ): Promise<typeof understandings.$inferSelect> {
    const createdAt = new Date().toISOString();
    const id = createEntityId();
    const body = normalizeUnderstandingWikiLinkBody(input.body) ?? "";
    await this.assertDomainIdsExist(input.domainIds);

    await this.db.transaction((tx) => {
      tx.insert(understandings)
        .values({
          id,
          title: input.title ?? null,
          body,
          createdAt,
          updatedAt: createdAt,
        })
        .run();

      if (input.domainIds && input.domainIds.length > 0) {
        tx.insert(understandingDomains)
          .values(
            input.domainIds.map((catId) => ({
              understandingId: id,
              domainId: catId,
            })),
          )
          .run();
      }
    });

    await this.syncWikiLinkConnections(id, body);

    const row = await this.getUnderstandingRow(id);
    if (!row) throw new Error(`Understanding not found after creation: ${id}`);
    await trySyncRetrievalIndexByUnderstandingId(this.db, id);
    return row;
  }

  async _updateUnderstanding(
    id: string,
    input: UpdateUnderstandingInput,
  ): Promise<typeof understandings.$inferSelect> {
    const updates: Partial<typeof understandings.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    const normalizedBody = normalizeUnderstandingWikiLinkBody(input.body);
    await this.assertDomainIdsExist(input.domainIds);
    if (normalizedBody !== undefined) updates.body = normalizedBody;
    if (input.title !== undefined) updates.title = input.title;

    await this.db.transaction((tx) => {
      const rows = tx
        .update(understandings)
        .set(updates)
        .where(eq(understandings.id, id))
        .returning()
        .all();
      if (rows.length === 0) {
        throw new Error(`Understanding not found: ${id}`);
      }

      if (input.domainIds !== undefined) {
        tx.delete(understandingDomains).where(eq(understandingDomains.understandingId, id)).run();
        if (input.domainIds.length > 0) {
          tx.insert(understandingDomains)
            .values(
              input.domainIds.map((catId) => ({
                understandingId: id,
                domainId: catId,
              })),
            )
            .run();
        }
      }
    });

    if (normalizedBody !== undefined) {
      await this.syncWikiLinkConnections(id, normalizedBody);
    }

    const row = await this.getUnderstandingRow(id);
    if (!row) throw new Error(`Understanding not found after update: ${id}`);
    // ponytail: edits can leave retrieval stale; rebuild on demand instead of blocking the UI.
    try {
      await markRetrievalIndexDirty();
    } catch {}
    return row;
  }

  async deleteUnderstanding(id: string): Promise<void> {
    await this.db.transaction((tx) => {
      const rows = tx
        .update(understandings)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(understandings.id, id))
        .returning()
        .all();
      if (rows.length === 0) {
        throw new Error(`Understanding not found: ${id}`);
      }
    });
    await trySyncRetrievalIndexByUnderstandingId(this.db, id);
  }

  async restoreUnderstanding(id: string): Promise<void> {
    let restored = false;
    await this.db.transaction((tx) => {
      const rows = tx
        .update(understandings)
        .set({ deletedAt: null })
        .where(and(eq(understandings.id, id), isNotNull(understandings.deletedAt)))
        .returning()
        .all();
      if (rows.length === 0) return;
      restored = true;
    });
    if (restored) await trySyncRetrievalIndexByUnderstandingId(this.db, id);
  }

  async permanentlyDeleteUnderstanding(id: string): Promise<void> {
    await this.db.transaction((tx) => {
      tx.delete(understandings).where(eq(understandings.id, id)).run();
    });
    await trySyncRetrievalIndexByUnderstandingId(this.db, id);
  }

  async syncWikiLinkConnections(sourceId: string, body: string): Promise<void> {
    const linkTargets = extractUnderstandingWikiLinkTargets(body);

    await this.db.transaction((tx) => {
      tx.delete(understandingConnections)
        .where(eq(understandingConnections.sourceId, sourceId))
        .run();

      if (linkTargets.length === 0) return;

      const rows = tx
        .select()
        .from(understandings)
        .where(
          and(
            isNull(understandings.deletedAt),
            or(inArray(understandings.id, linkTargets), inArray(understandings.title, linkTargets)),
          ),
        )
        .orderBy(desc(understandings.updatedAt))
        .all();

      const targetIds = new Set<string>();
      for (const target of linkTargets) {
        const row = rows.find((t) => t.id === target) ?? rows.find((t) => t.title === target);
        if (row && row.id !== sourceId) targetIds.add(row.id);
      }

      if (targetIds.size === 0) return;
      tx.insert(understandingConnections)
        .values([...targetIds].map((targetId) => ({ sourceId, targetId })))
        .onConflictDoNothing()
        .run();
    });
  }

  private async assertDomainIdsExist(domainIds: string[] | undefined): Promise<void> {
    if (!domainIds?.length) return;
    const uniqueIds = [...new Set(domainIds)];
    const rows = await this.db
      .select({ id: domains.id })
      .from(domains)
      .where(inArray(domains.id, uniqueIds));
    if (rows.length === uniqueIds.length) return;
    const found = new Set(rows.map((row) => row.id));
    const missing = uniqueIds.find((domainId) => !found.has(domainId));
    throw new Error(`Domain not found: ${missing}`);
  }
}

export async function toUnderstandingSummaries(
  db: ReflectaDb,
  rows: Array<typeof understandings.$inferSelect>,
): Promise<UnderstandingSummary[]> {
  const ids = rows.map((r) => r.id);
  const catRefs = await resolveDomainRefs(db, ids);
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? null,
    body: row.body,
    domains: catRefs.get(row.id) ?? [],
  }));
}
