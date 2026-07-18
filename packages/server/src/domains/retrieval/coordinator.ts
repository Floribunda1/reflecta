import type { ReflectaDb } from "../../db/types";
import type { RetrievalIndexUpdateSink } from "../shared/types";
import { getRetrievalEmbeddingModelId } from "./embedding-config";
import {
  RETRIEVAL_PROJECTION_VERSION,
  createRetrievalIndex,
  getRetrievalTableName,
  rebuildRetrievalIndex,
  reconcileRetrievalIndex,
  syncRetrievalIndexByUnderstandingIds,
  type RetrievalIndexProgress,
  type RetrievalIndexWorkResult,
} from "./sync";

export type RetrievalIndexStatus = {
  state: "not_ready" | "indexing" | "ready" | "error";
  embeddingModel: string;
  projectionVersion: number;
  tableName: string;
  progress?: RetrievalIndexProgress;
  error?: string;
};

export type RetrievalIndexOperations = {
  reconcile(
    db: ReflectaDb,
    onProgress: (progress: RetrievalIndexProgress) => void,
  ): Promise<RetrievalIndexWorkResult>;
  sync(
    db: ReflectaDb,
    understandingIds: string[],
    onProgress: (progress: RetrievalIndexProgress) => void,
  ): Promise<RetrievalIndexWorkResult>;
  rebuild(
    db: ReflectaDb,
    onProgress: (progress: RetrievalIndexProgress) => void,
  ): Promise<RetrievalIndexWorkResult>;
  isReady(): Promise<boolean>;
  optimize(): Promise<void>;
};

export type RetrievalIndexCoordinatorOptions = {
  getDb: () => ReflectaDb;
  operations?: RetrievalIndexOperations;
  optimizeAfterOperations?: number;
};

function defaultOperations(): RetrievalIndexOperations {
  return {
    reconcile: (db, onProgress) => reconcileRetrievalIndex(db, { onProgress }),
    sync: (db, understandingIds, onProgress) =>
      syncRetrievalIndexByUnderstandingIds(db, understandingIds, { onProgress }),
    rebuild: (db, onProgress) => rebuildRetrievalIndex(db, { onProgress }),
    isReady: () => createRetrievalIndex().isReady(),
    optimize: () => createRetrievalIndex().optimize(),
  };
}

export class RetrievalIndexCoordinator implements RetrievalIndexUpdateSink {
  private readonly pendingIds = new Set<string>();
  private readonly operations: RetrievalIndexOperations;
  private readonly optimizeAfterOperations: number;
  private running?: Promise<void>;
  private reconcileRequested = false;
  private rebuildRequested = false;
  private stopped = false;
  private modificationOperations = 0;
  private progress?: RetrievalIndexProgress;
  private lastError?: Error;

  constructor(private readonly options: RetrievalIndexCoordinatorOptions) {
    this.operations = options.operations ?? defaultOperations();
    this.optimizeAfterOperations = options.optimizeAfterOperations ?? 20;
  }

  start(): void {
    if (this.stopped) return;
    this.reconcileRequested = true;
    this.lastError = undefined;
    this.kick();
  }

  enqueue(understandingIds: Iterable<string>): void {
    if (this.stopped) return;
    try {
      for (const id of understandingIds) {
        if (id) this.pendingIds.add(id);
      }
      if (this.pendingIds.size === 0) return;
      this.lastError = undefined;
      this.kick();
    } catch {
      // Product writes must never fail because background indexing could not be scheduled.
    }
  }

  async flush(): Promise<void> {
    while (this.running || this.hasWork()) {
      this.kick();
      if (this.running) await this.running;
    }
    if (this.lastError) throw this.lastError;
  }

  async rebuild(): Promise<void> {
    if (this.stopped) throw new Error("Retrieval index coordinator is stopped");
    this.rebuildRequested = true;
    this.lastError = undefined;
    this.kick();
    await this.flush();
  }

  async getStatus(): Promise<RetrievalIndexStatus> {
    const base = {
      embeddingModel: getRetrievalEmbeddingModelId(),
      projectionVersion: RETRIEVAL_PROJECTION_VERSION,
      tableName: getRetrievalTableName(),
    };
    if (this.running || this.hasWork())
      return { ...base, state: "indexing", progress: this.progress };
    if (this.lastError) return { ...base, state: "error", error: this.lastError.message };
    if (!(await this.operations.isReady())) return { ...base, state: "not_ready" };
    return { ...base, state: "ready" };
  }

  stop(): void {
    this.stopped = true;
    this.pendingIds.clear();
    this.reconcileRequested = false;
    this.rebuildRequested = false;
  }

  private hasWork() {
    return this.rebuildRequested || this.reconcileRequested || this.pendingIds.size > 0;
  }

  private kick() {
    if (this.stopped || this.running || !this.hasWork()) return;
    this.running = this.runLoop().finally(() => {
      this.running = undefined;
      this.progress = undefined;
      if (this.hasWork()) this.kick();
    });
    void this.running.catch(() => undefined);
  }

  private async runLoop() {
    while (!this.stopped && this.hasWork()) {
      let work: () => Promise<RetrievalIndexWorkResult>;
      if (this.rebuildRequested) {
        this.rebuildRequested = false;
        this.reconcileRequested = false;
        this.pendingIds.clear();
        work = () =>
          this.operations.rebuild(this.options.getDb(), (value) => (this.progress = value));
      } else if (this.reconcileRequested) {
        this.reconcileRequested = false;
        work = () =>
          this.operations.reconcile(this.options.getDb(), (value) => (this.progress = value));
      } else {
        const ids = [...this.pendingIds];
        this.pendingIds.clear();
        work = () =>
          this.operations.sync(this.options.getDb(), ids, (value) => (this.progress = value));
      }

      const result = await this.runWithOneRetry(work);
      if (!result) return;
      this.lastError = undefined;
      this.modificationOperations += result.operationCount;
      if (this.modificationOperations >= this.optimizeAfterOperations) {
        const optimized = await this.runWithOneRetry(async () => {
          await this.operations.optimize();
          return { modified: false, operationCount: 0 };
        });
        if (!optimized) return;
        this.modificationOperations = 0;
      }
    }
  }

  private async runWithOneRetry(
    work: () => Promise<RetrievalIndexWorkResult>,
  ): Promise<RetrievalIndexWorkResult | undefined> {
    try {
      return await work();
    } catch {
      try {
        return await work();
      } catch (error) {
        this.lastError = error instanceof Error ? error : new Error(String(error));
        return undefined;
      }
    }
  }
}
