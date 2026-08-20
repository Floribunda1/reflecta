import { Effect } from "effect";
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
import type { EmbeddingProvider, RetrievalDocument } from "./types";

export const RETRIEVAL_PROJECTION_VERSION = 4;

export type RetrievalIndexProgress = {
  phase: "preparing" | "embedding" | "writing";
  completed: number;
  total: number;
  percent: number;
};

export type RetrievalIndexWorkResult = {
  modified: boolean;
  operationCount: number;
};

type RetrievalIndexWorkOptions = {
  onProgress?: (progress: RetrievalIndexProgress) => void;
};

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

function reportProgress(
  options: RetrievalIndexWorkOptions | undefined,
  phase: RetrievalIndexProgress["phase"],
  completed: number,
  total: number,
) {
  options?.onProgress?.({
    phase,
    completed,
    total,
    percent: total <= 0 ? 0 : Math.min(100, Math.round((completed / total) * 100)),
  });
}

function safeTableSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "default"
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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

export const buildRetrievalDocumentsFromDb = Effect.fn("buildRetrievalDocumentsFromDb")(function* (
  db: ReflectaDb,
  understandingIds?: string[],
): Effect.fn.Return<RetrievalDocument[]> {
  const db_ = db;
  const conditions = [isNull(understandings.deletedAt)];
  if (understandingIds !== undefined) {
    if (understandingIds.length === 0) return [];
    conditions.push(inArray(understandings.id, understandingIds));
  }

  const understandingRows = yield* Effect.promise(() =>
    db_
      .select()
      .from(understandings)
      .where(and(...conditions))
      .orderBy(desc(understandings.updatedAt)),
  );
  if (understandingRows.length === 0) return [];

  const activeUnderstandingIds = understandingRows.map((understanding) => understanding.id);
  const [domainRefs, contextRows] = yield* Effect.all([
    resolveDomainRefs(db_, activeUnderstandingIds),
    Effect.promise(() =>
      db_
        .select()
        .from(contexts)
        .where(
          and(
            inArray(contexts.understandingId, activeUnderstandingIds),
            isNull(contexts.deletedAt),
          ),
        ),
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
});

export const rebuildRetrievalIndex = Effect.fn("rebuildRetrievalIndex")(function* (
  db: ReflectaDb,
  options?: RetrievalIndexWorkOptions,
): Effect.fn.Return<RetrievalIndexWorkResult, Error> {
  reportProgress(options, "preparing", 0, 0);
  const docs = yield* buildRetrievalDocumentsFromDb(db);
  reportProgress(options, "embedding", 0, docs.length);
  yield* Effect.tryPromise({
    try: () =>
      createRetrievalIndex().replaceAll(docs, {
        onEmbeddingProgress: ({ completed, total }) =>
          reportProgress(options, "embedding", completed, total),
        onWritingStart: () => reportProgress(options, "writing", docs.length, docs.length),
      }),
    catch: toError,
  });
  return { modified: true, operationCount: 0 };
});

export const syncRetrievalIndexByUnderstandingIds = Effect.fn(
  "syncRetrievalIndexByUnderstandingIds",
)(function* (
  db: ReflectaDb,
  understandingIds: string[],
  options?: RetrievalIndexWorkOptions,
): Effect.fn.Return<RetrievalIndexWorkResult, Error> {
  const ids = [...new Set(understandingIds)];
  if (ids.length === 0) return { modified: false, operationCount: 0 };
  const index = createRetrievalIndex();
  if (!(yield* Effect.tryPromise({ try: () => index.isReady(), catch: toError }))) {
    return yield* rebuildRetrievalIndex(db, options);
  }

  reportProgress(options, "preparing", 0, ids.length);
  const docs = yield* buildRetrievalDocumentsFromDb(db, ids);
  reportProgress(options, "embedding", 0, docs.length);
  yield* Effect.tryPromise({
    try: () =>
      index.replaceUnderstandingDocuments(ids, docs, {
        onEmbeddingProgress: ({ completed, total }) =>
          reportProgress(options, "embedding", completed, total),
        onWritingStart: () => reportProgress(options, "writing", ids.length, ids.length),
      }),
    catch: toError,
  });
  return { modified: true, operationCount: 1 };
});

export const reconcileRetrievalIndex = Effect.fn("reconcileRetrievalIndex")(function* (
  db: ReflectaDb,
  options?: RetrievalIndexWorkOptions,
): Effect.fn.Return<RetrievalIndexWorkResult, Error> {
  reportProgress(options, "preparing", 0, 0);
  const index = createRetrievalIndex();
  const manifest = yield* Effect.tryPromise({ try: () => index.readManifest(), catch: toError });
  if (manifest === null) return yield* rebuildRetrievalIndex(db, options);

  const docs = yield* buildRetrievalDocumentsFromDb(db);
  const currentById = new Map(docs.map((doc) => [doc.id, doc]));
  const indexedById = new Map(manifest.map((entry) => [entry.id, entry]));
  const affectedIds = new Set<string>();

  for (const doc of docs) {
    if (indexedById.get(doc.id)?.contentHash !== doc.contentHash) {
      affectedIds.add(doc.parentUnderstandingId);
    }
  }
  for (const entry of manifest) {
    if (!currentById.has(entry.id)) affectedIds.add(entry.parentUnderstandingId);
  }

  if (affectedIds.size === 0) return { modified: false, operationCount: 0 };
  return yield* syncRetrievalIndexByUnderstandingIds(db, [...affectedIds], options);
});
