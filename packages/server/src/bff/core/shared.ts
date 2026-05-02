import { eq, inArray, sql, count } from "drizzle-orm";
import { categories, thoughtCategories, thoughtConnections } from "../../db/schema";
import type { ReflectaDb, SearchOptions } from "./types";

export function getLimitOffset(options?: SearchOptions) {
  return {
    limit: options?.limit ?? 20,
    offset: options?.offset ?? 0,
  };
}

export function escapeFtsQuery(query: string): string {
  return `"${query.replace(/"/g, '""')}"`;
}

export async function getCategoryDescendants(
  db: ReflectaDb,
  categoryId: string,
): Promise<string[]> {
  const result = await db.all<{ id: string }>(sql`
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM categories WHERE parent_id = ${categoryId}
      UNION ALL
      SELECT c.id FROM categories c
      INNER JOIN descendants d ON c.parent_id = d.id
    )
    SELECT id FROM descendants
  `);
  return result.map((r) => r.id);
}

export async function resolveCategoryRefs(
  db: ReflectaDb,
  thoughtIds: string[],
): Promise<Map<string, { id: string; name: string; parentId: string | null }[]>> {
  if (thoughtIds.length === 0) return new Map();

  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  const tcRows = await db
    .select()
    .from(thoughtCategories)
    .where(inArray(thoughtCategories.thoughtId, thoughtIds));

  const result = new Map<string, { id: string; name: string; parentId: string | null }[]>();
  for (const tc of tcRows) {
    const cat = catMap.get(tc.categoryId);
    if (!cat) continue;
    const refs = result.get(tc.thoughtId) ?? [];
    refs.push({ id: cat.id, name: cat.name, parentId: cat.parentId });
    result.set(tc.thoughtId, refs);
  }
  return result;
}

export async function getThoughtConnectionCounts(
  db: ReflectaDb,
  thoughtId: string,
): Promise<{ contextCount: number; referenceCount: number; referencedByCount: number }> {
  const [ctxCountRes, refCountRes, refByCountRes] = await Promise.all([
    db
      .select({ count: count() })
      .from(thoughtConnections)
      .where(eq(thoughtConnections.sourceId, thoughtId)),
    db
      .select({ count: count() })
      .from(thoughtConnections)
      .where(eq(thoughtConnections.targetId, thoughtId)),
    db
      .select({ count: count() })
      .from(thoughtConnections)
      .where(eq(thoughtConnections.targetId, thoughtId)),
  ]);

  return {
    contextCount: ctxCountRes[0]?.count ?? 0,
    referenceCount: refCountRes[0]?.count ?? 0,
    referencedByCount: refByCountRes[0]?.count ?? 0,
  };
}

export function makePageInfo(limit: number, offset: number, hasMore: boolean) {
  return {
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}
