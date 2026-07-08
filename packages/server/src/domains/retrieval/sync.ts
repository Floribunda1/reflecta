import { and, desc, inArray, isNull } from "drizzle-orm";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
import { LlamaCppEmbeddingProvider } from "./llama-cpp-embedding";
import { OpenAiCompatibleEmbeddingProvider } from "./openai-compatible-embedding";
import { buildRetrievalDocuments } from "./projection";

export const RETRIEVAL_PROJECTION_VERSION = 2;

export type RetrievalIndexProgress = {
  phase: "preparing" | "embedding" | "writing";
  completed: number;
  total: number;
  percent: number;
};

export type RetrievalIndexStatus = {
  state: "not_ready" | "dirty" | "indexing" | "ready" | "error";
  embeddingModel: string;
  projectionVersion: number;
  tableName: string;
  progress?: RetrievalIndexProgress;
  error?: string;
};

let activeRebuild: Promise<void> | null = null;
let lastRebuildError: string | undefined;
let activeRebuildProgress: RetrievalIndexProgress | undefined;
let markerSequence = 0;

function markerStamp() {
  markerSequence = (markerSequence + 1) % 1000;
  return Date.now() * 1000 + markerSequence;
}

function updateActiveRebuildProgress(
  phase: RetrievalIndexProgress["phase"],
  completed: number,
  total: number,
) {
  activeRebuildProgress = {
    phase,
    completed,
    total,
    percent: total <= 0 ? 0 : Math.min(100, Math.round((completed / total) * 100)),
  };
}

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
  if (config.provider === "local-llama-cpp") {
    return new LlamaCppEmbeddingProvider({
      modelId: config.modelId,
      modelPath: config.modelPath ?? "",
    });
  }
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

function resolveRetrievalDirtyUnderstandingDirPath() {
  return join(resolveRetrievalIndexPath(), ".dirty-understandings");
}

function resolveRetrievalDirtyUnderstandingPath(understandingId: string) {
  return join(resolveRetrievalDirtyUnderstandingDirPath(), encodeURIComponent(understandingId));
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
  await writeFile(resolveRetrievalDirtyMarkerPath(), String(markerStamp()));
}

export async function markRetrievalIndexDirtyByUnderstandingId(
  understandingId: string,
): Promise<void> {
  await mkdir(resolveRetrievalDirtyUnderstandingDirPath(), { recursive: true });
  await writeFile(resolveRetrievalDirtyUnderstandingPath(understandingId), String(markerStamp()));
}

async function markerTime(path: string): Promise<number> {
  const raw = Number(await readFile(path, "utf-8"));
  return Number.isFinite(raw) ? raw : 0;
}

async function clearDirtyMarker(path: string, createdBefore?: number): Promise<void> {
  if (createdBefore !== undefined) {
    try {
      if ((await markerTime(path)) >= createdBefore) return;
    } catch {
      return;
    }
  }
  await rm(path, { force: true });
}

export async function clearRetrievalIndexDirty(createdBefore?: number): Promise<void> {
  await clearDirtyMarker(resolveRetrievalDirtyMarkerPath(), createdBefore);
  const understandingIds = await getDirtyRetrievalUnderstandingIds();
  await Promise.all(
    understandingIds.map((id) => clearDirtyRetrievalUnderstandingId(id, createdBefore)),
  );
}

export async function clearDirtyRetrievalUnderstandingId(
  understandingId: string,
  createdBefore?: number,
): Promise<void> {
  await clearDirtyMarker(resolveRetrievalDirtyUnderstandingPath(understandingId), createdBefore);
}

export async function isRetrievalIndexFullyDirty(): Promise<boolean> {
  try {
    await access(resolveRetrievalDirtyMarkerPath());
    return true;
  } catch {
    return false;
  }
}

export async function getDirtyRetrievalUnderstandingIds(): Promise<string[]> {
  try {
    const entries = await readdir(resolveRetrievalDirtyUnderstandingDirPath(), {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => decodeURIComponent(entry.name))
      .sort();
  } catch {
    return [];
  }
}

export async function isRetrievalIndexDirty(): Promise<boolean> {
  return (
    (await isRetrievalIndexFullyDirty()) || (await getDirtyRetrievalUnderstandingIds()).length > 0
  );
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
  const index = createRetrievalIndex();
  if (!(await index.isReady())) throw new Error("Retrieval index is not ready");
  await index.syncByUnderstandingId(
    understandingId,
    await buildRetrievalDocumentsFromDb(db, [understandingId]),
  );
}

export async function rebuildRetrievalIndex(db: ReflectaDb): Promise<void> {
  const startedAt = markerStamp();
  updateActiveRebuildProgress("preparing", 0, 0);
  const docs = await buildRetrievalDocumentsFromDb(db);
  updateActiveRebuildProgress("embedding", 0, docs.length);
  await createRetrievalIndex().replaceAll(docs, {
    onEmbeddingProgress: ({ completed, total }) =>
      updateActiveRebuildProgress("embedding", completed, total),
    onWritingStart: () => updateActiveRebuildProgress("writing", docs.length, docs.length),
  });
  await clearRetrievalIndexDirty(startedAt);
}

export async function rebuildRetrievalIndexWithStatus(db: ReflectaDb): Promise<void> {
  if (activeRebuild) return activeRebuild;
  activeRebuild = (async () => {
    try {
      lastRebuildError = undefined;
      await rebuildRetrievalIndex(db);
    } catch (error) {
      lastRebuildError = error instanceof Error ? error.message : String(error);
      await markRetrievalIndexDirty();
      throw error;
    } finally {
      activeRebuild = null;
      activeRebuildProgress = undefined;
    }
  })();
  return activeRebuild;
}

export async function syncDirtyRetrievalIndexWithStatus(db: ReflectaDb): Promise<void> {
  if (activeRebuild) return activeRebuild;
  activeRebuild = (async () => {
    try {
      lastRebuildError = undefined;
      const index = createRetrievalIndex();
      if (!(await index.isReady()) || (await isRetrievalIndexFullyDirty())) {
        await rebuildRetrievalIndex(db);
        return;
      }

      const understandingIds = await getDirtyRetrievalUnderstandingIds();
      updateActiveRebuildProgress("preparing", 0, understandingIds.length);
      for (const [index, understandingId] of understandingIds.entries()) {
        const startedAt = markerStamp();
        updateActiveRebuildProgress("embedding", index, understandingIds.length);
        await syncRetrievalIndexByUnderstandingId(db, understandingId);
        await clearDirtyRetrievalUnderstandingId(understandingId, startedAt);
      }
      updateActiveRebuildProgress("writing", understandingIds.length, understandingIds.length);
    } catch (error) {
      lastRebuildError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      activeRebuild = null;
      activeRebuildProgress = undefined;
    }
  })();
  return activeRebuild;
}

export async function getRetrievalIndexStatus(): Promise<RetrievalIndexStatus> {
  const base = {
    embeddingModel: getRetrievalEmbeddingModelId(),
    projectionVersion: RETRIEVAL_PROJECTION_VERSION,
    tableName: getRetrievalTableName(),
  };
  if (activeRebuild) return { ...base, state: "indexing", progress: activeRebuildProgress };
  if (lastRebuildError) return { ...base, state: "error", error: lastRebuildError };
  const index = createRetrievalIndex();
  if (!(await index.isReady())) return { ...base, state: "not_ready" };
  if (await isRetrievalIndexDirty()) return { ...base, state: "dirty" };
  return { ...base, state: "ready" };
}
