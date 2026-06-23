import { and, desc, inArray, isNull } from "drizzle-orm";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contexts, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { resolveDomainRefs } from "../domain/core";
import { LanceDbRetrievalIndex } from "./lancedb-index";
import { LocalEmbeddingProvider } from "./local-embedding";
import { buildRetrievalDocuments } from "./projection";

export function createRetrievalIndex() {
  return new LanceDbRetrievalIndex({
    uri:
      process.env.REFLECTA_RETRIEVAL_INDEX_PATH ??
      join(tmpdir(), "reflecta-retrieval-index", String(process.pid)),
    embeddingProvider: new LocalEmbeddingProvider(),
  });
}

export async function buildRetrievalDocumentsFromDb(db: ReflectaDb, understandingIds?: string[]) {
  const conditions = [isNull(understandings.deletedAt)];
  if (understandingIds !== undefined) {
    if (understandingIds.length === 0) return [];
    conditions.push(inArray(understandings.id, understandingIds));
  }

  const understandingRows = await db
    .select()
    .from(understandings)
    .where(and(...conditions))
    .orderBy(desc(understandings.updatedAt));
  if (understandingRows.length === 0) return [];

  const activeUnderstandingIds = understandingRows.map((understanding) => understanding.id);
  const [domainRefs, contextRows] = await Promise.all([
    resolveDomainRefs(db, activeUnderstandingIds),
    db
      .select()
      .from(contexts)
      .where(
        and(inArray(contexts.understandingId, activeUnderstandingIds), isNull(contexts.deletedAt)),
      ),
  ]);
  const contextsByUnderstandingId = new Map<string, typeof contextRows>();
  for (const context of contextRows) {
    const items = contextsByUnderstandingId.get(context.understandingId) ?? [];
    items.push(context);
    contextsByUnderstandingId.set(context.understandingId, items);
  }

  return understandingRows.flatMap((understanding) =>
    buildRetrievalDocuments({
      understanding,
      domains: domainRefs.get(understanding.id) ?? [],
      contexts: (contextsByUnderstandingId.get(understanding.id) ?? []).map((context) => ({
        id: context.id,
        medium: context.medium,
        title: context.title,
        content: context.content,
        createdAt: context.createdAt,
      })),
    }),
  );
}

export async function syncRetrievalIndexByUnderstandingId(
  db: ReflectaDb,
  understandingId: string,
): Promise<void> {
  await createRetrievalIndex().syncByUnderstandingId(
    understandingId,
    await buildRetrievalDocumentsFromDb(db, [understandingId]),
  );
}

export async function trySyncRetrievalIndexByUnderstandingId(
  db: ReflectaDb,
  understandingId: string,
): Promise<void> {
  try {
    await syncRetrievalIndexByUnderstandingId(db, understandingId);
  } catch {
    // ponytail: keep product writes durable; search rebuilds the projection if sync misses.
  }
}
