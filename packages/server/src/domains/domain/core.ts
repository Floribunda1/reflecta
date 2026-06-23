import { eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { domains, understandingDomains, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { CreateDomainInput, ReorderDomainItem, UpdateDomainInput } from "./types";

export async function getDomainDescendants(db: ReflectaDb, domainId: string): Promise<string[]> {
  const result = await db.all<{ id: string }>(sql`
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM domains WHERE parent_id = ${domainId}
      UNION ALL
      SELECT c.id FROM domains c
      INNER JOIN descendants d ON c.parent_id = d.id
    )
    SELECT id FROM descendants
  `);
  return result.map((r) => r.id);
}

export class DomainCore {
  constructor(protected db: ReflectaDb) {}

  async listDomainRows(): Promise<Array<typeof domains.$inferSelect>> {
    return this.db.select().from(domains).orderBy(domains.sortOrder);
  }

  async getDomainRow(id: string): Promise<typeof domains.$inferSelect | null> {
    const rows = await this.db.select().from(domains).where(eq(domains.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createDomain(input: CreateDomainInput): Promise<typeof domains.$inferSelect> {
    const createdAt = new Date().toISOString();
    const parentId = input.parentId ?? null;
    await this.assertValidParent(undefined, parentId);

    const maxOrderResult = await this.db
      .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)` })
      .from(domains)
      .where(parentId ? eq(domains.parentId, parentId) : sql`parent_id IS NULL`);
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const rows = await this.db
      .insert(domains)
      .values({
        id: nanoid(),
        name: input.name,
        parentId,
        sortOrder: nextOrder,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    return rows[0];
  }

  async updateDomain(id: string, input: UpdateDomainInput): Promise<typeof domains.$inferSelect> {
    if (input.parentId !== undefined) {
      await this.assertValidParent(id, input.parentId);
    }

    const updates: Partial<typeof domains.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.parentId !== undefined) updates.parentId = input.parentId;

    const rows = await this.db.update(domains).set(updates).where(eq(domains.id, id)).returning();
    if (rows.length === 0) {
      throw new Error(`Domain not found: ${id}`);
    }
    return rows[0];
  }

  async deleteDomain(id: string, deleteUnderstandings = false): Promise<void> {
    const domain = await this.getDomainRow(id);
    if (!domain) {
      throw new Error(`Domain not found: ${id}`);
    }
    await this.db.transaction((tx) => {
      if (deleteUnderstandings) {
        const rows = tx
          .select({ understandingId: understandingDomains.understandingId })
          .from(understandingDomains)
          .where(eq(understandingDomains.domainId, id))
          .all();
        const understandingIds = rows.map((r) => r.understandingId);
        if (understandingIds.length > 0) {
          tx.delete(understandings).where(inArray(understandings.id, understandingIds)).run();
        }
      }
      tx.delete(domains).where(eq(domains.id, id)).run();
    });
  }

  async reorderDomains(items: ReorderDomainItem[]): Promise<void> {
    const updatedAt = new Date().toISOString();
    await this.db.transaction((tx) => {
      for (const item of items) {
        tx.update(domains)
          .set({
            parentId: item.parentId,
            sortOrder: item.sortOrder,
            updatedAt,
          })
          .where(eq(domains.id, item.id))
          .run();
      }
    });
  }

  private async assertValidParent(id: string | undefined, parentId: string | null): Promise<void> {
    if (parentId === null) return;
    if (parentId === id) throw new Error("Domain cannot be its own parent");
    if (!(await this.getDomainRow(parentId))) {
      throw new Error(`Domain not found: ${parentId}`);
    }
    if (!id) return;
    const descendants = await getDomainDescendants(this.db, id);
    if (descendants.includes(parentId)) {
      throw new Error("Domain cannot be moved under its descendant");
    }
  }
}

export async function resolveDomainRefs(
  db: ReflectaDb,
  understandingIds: string[],
): Promise<Map<string, { id: string; name: string; parentId: string | null }[]>> {
  if (understandingIds.length === 0) return new Map();

  const tcRows = await db
    .select()
    .from(understandingDomains)
    .where(inArray(understandingDomains.understandingId, understandingIds));

  const domainIds = [...new Set(tcRows.map((tc) => tc.domainId))];
  const catRows =
    domainIds.length > 0
      ? await db.select().from(domains).where(inArray(domains.id, domainIds))
      : [];
  const catMap = new Map(catRows.map((c) => [c.id, c]));

  const result = new Map<string, { id: string; name: string; parentId: string | null }[]>();
  for (const tc of tcRows) {
    const cat = catMap.get(tc.domainId);
    if (!cat) continue;
    const refs = result.get(tc.understandingId) ?? [];
    refs.push({ id: cat.id, name: cat.name, parentId: cat.parentId });
    result.set(tc.understandingId, refs);
  }
  return result;
}
