import { thoughts } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { resolveCategoryRefs as coreResolveCategoryRefs } from "../../bff/core/shared";
import type { CategoryRef, ThoughtSummary, ThoughtType } from "./types";

export async function resolveCategoryRefs(
  db: ReflectaDb,
  thoughtIds: string[],
): Promise<Map<string, CategoryRef[]>> {
  const result = await coreResolveCategoryRefs(db, thoughtIds);
  return result as Map<string, CategoryRef[]>;
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
