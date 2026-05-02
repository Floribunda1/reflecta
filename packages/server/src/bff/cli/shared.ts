import { eq, inArray, sql, count } from "drizzle-orm";
import { categories, thoughtCategories, thoughtConnections, thoughts } from "../../db/schema";
import type { ReflectaDb } from "../electron/types";
import type { CategoryRef, PageInfo, SourceType, ThoughtSummary, ThoughtType } from "./types";

export async function resolveCategoryRefs(
  db: ReflectaDb,
  thoughtIds: string[],
): Promise<Map<string, CategoryRef[]>> {
  if (thoughtIds.length === 0) return new Map();

  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  const tcRows = await db
    .select()
    .from(thoughtCategories)
    .where(inArray(thoughtCategories.thoughtId, thoughtIds));

  const result = new Map<string, CategoryRef[]>();
  for (const tc of tcRows) {
    const cat = catMap.get(tc.categoryId);
    if (!cat) continue;
    const refs = result.get(tc.thoughtId) ?? [];
    refs.push({ id: cat.id, name: cat.name, parentId: cat.parentId });
    result.set(tc.thoughtId, refs);
  }
  return result;
}

export async function toThoughtSummaries(
  db: ReflectaDb,
  rows: Array<typeof thoughts.$inferSelect>,
): Promise<ThoughtSummary[]> {
  const ids = rows.map((r) => r.id);
  const catRefs = await resolveCategoryRefs(db, ids);
  return rows.map((row) => ({
    id: row.id,
    type: row.type as ThoughtType,
    title: row.title ?? null,
    body: row.body,
    categories: catRefs.get(row.id) ?? [],
  }));
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

export function makePageInfo(limit: number, offset: number, hasMore: boolean): PageInfo {
  return {
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
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

export function rowToContextDetail(
  row: typeof thoughts.$inferSelect & {
    sourceType?: string;
    sourceName?: string | null;
    content?: string;
    thoughtId?: string;
  },
): {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
} {
  return {
    id: row.id,
    thoughtId: (row as unknown as { thoughtId: string }).thoughtId ?? row.id,
    sourceType: (row.sourceType ?? "experience") as SourceType,
    sourceName: row.sourceName ?? null,
    content: (row as unknown as { content: string }).content ?? "",
  };
}
