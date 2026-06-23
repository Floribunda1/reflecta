import { and, desc, inArray, isNull } from "drizzle-orm";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contexts, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { resolveDomainRefs } from "../domain/core";
import {
  DisabledEmbeddingProvider,
  getRetrievalEmbeddingConfig,
  getRetrievalEmbeddingModelId,
} from "./embedding-config";
import { LanceDbRetrievalIndex } from "./lancedb-index";
import { OpenAiCompatibleEmbeddingProvider } from "./openai-compatible-embedding";
import { buildRetrievalDocuments } from "./projection";

export const RETRIEVAL_PROJECTION_VERSION = 1;

function safeTableSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "default"
  );
}

function createEmbeddingProvider() {
  const config = getRetrievalEmbeddingConfig();
  if (config.provider === "openai-compatible" && config.baseUrl) {
    return new OpenAiCompatibleEmbeddingProvider({
      baseUrl: config.baseUrl,
      modelId: config.modelId,
      apiKey: config.apiKey,
    });
  }
  return new DisabledEmbeddingProvider();
}

export function getRetrievalTableName() {
  return `retrieval_documents_p${RETRIEVAL_PROJECTION_VERSION}_${safeTableSegment(getRetrievalEmbeddingModelId())}`;
}

function resolveRetrievalIndexPath() {
  return (
    process.env.REFLECTA_RETRIEVAL_INDEX_PATH ??
    join(tmpdir(), "reflecta-retrieval-index", String(process.pid))
  );
}

function resolveRetrievalDirtyMarkerPath() {
  return join(resolveRetrievalIndexPath(), ".dirty");
}

export function createRetrievalIndex() {
  return new LanceDbRetrievalIndex({
    uri: resolveRetrievalIndexPath(),
    embeddingProvider: createEmbeddingProvider(),
    tableName: getRetrievalTableName(),
  });
}

export async function markRetrievalIndexDirty(): Promise<void> {
  await mkdir(resolveRetrievalIndexPath(), { recursive: true });
  await writeFile(resolveRetrievalDirtyMarkerPath(), String(Date.now()));
}

export async function clearRetrievalIndexDirty(): Promise<void> {
  await rm(resolveRetrievalDirtyMarkerPath(), { force: true });
}

export async function isRetrievalIndexDirty(): Promise<boolean> {
  try {
    await access(resolveRetrievalDirtyMarkerPath());
    return true;
  } catch {
    return false;
  }
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

export async function rebuildRetrievalIndex(db: ReflectaDb): Promise<void> {
  await createRetrievalIndex().replaceAll(await buildRetrievalDocumentsFromDb(db));
  await clearRetrievalIndexDirty();
}

export async function trySyncRetrievalIndexByUnderstandingId(
  db: ReflectaDb,
  understandingId: string,
): Promise<void> {
  try {
    await syncRetrievalIndexByUnderstandingId(db, understandingId);
  } catch {
    // ponytail: file marker is enough; SQLite stays source of truth and search rebuilds.
    try {
      await markRetrievalIndexDirty();
    } catch {}
  }
}
