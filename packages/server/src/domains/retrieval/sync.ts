import { and, desc, inArray, isNull } from "drizzle-orm";
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
import type { EmbeddingProvider } from "./types";

export const RETRIEVAL_PROJECTION_VERSION = 2;

export type RetrievalIndexProgress = {
  phase: "preparing" | "embedding" | "writing";
  completed: number;
  total: number;
  percent: number;
};

export type RetrievalIndexStatus = {
  state: "not_ready" | "indexing" | "ready" | "error";
  embeddingModel: string;
  projectionVersion: number;
  tableName: string;
  progress?: RetrievalIndexProgress;
  error?: string;
};

let activeRebuild: Promise<void> | null = null;
let lastRebuildError: string | undefined;
let activeRebuildProgress: RetrievalIndexProgress | undefined;
let embeddingProviderFactory:
  | ((config: ReturnType<typeof getRetrievalEmbeddingConfig>) => EmbeddingProvider | undefined)
  | undefined;

export function configureRetrievalEmbeddingProviderFactory(
  factory?: (
    config: ReturnType<typeof getRetrievalEmbeddingConfig>,
  ) => EmbeddingProvider | undefined,
): void {
  embeddingProviderFactory = factory;
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
  const configuredProvider = embeddingProviderFactory?.(config);
  if (configuredProvider) return configuredProvider;
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

export function createRetrievalIndex() {
  return new LanceDbRetrievalIndex({
    uri: resolveRetrievalIndexPath(),
    embeddingProvider: createEmbeddingProvider(),
    tableName: getRetrievalTableName(),
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

export async function rebuildRetrievalIndex(db: ReflectaDb): Promise<void> {
  updateActiveRebuildProgress("preparing", 0, 0);
  const docs = await buildRetrievalDocumentsFromDb(db);
  updateActiveRebuildProgress("embedding", 0, docs.length);
  await createRetrievalIndex().replaceAll(docs, {
    onEmbeddingProgress: ({ completed, total }) =>
      updateActiveRebuildProgress("embedding", completed, total),
    onWritingStart: () => updateActiveRebuildProgress("writing", docs.length, docs.length),
  });
}

export async function rebuildRetrievalIndexWithStatus(db: ReflectaDb): Promise<void> {
  if (activeRebuild) return activeRebuild;
  activeRebuild = (async () => {
    try {
      lastRebuildError = undefined;
      await rebuildRetrievalIndex(db);
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
  if (!(await createRetrievalIndex().isReady())) return { ...base, state: "not_ready" };
  return { ...base, state: "ready" };
}
