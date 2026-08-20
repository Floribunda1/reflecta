import { Deferred, Effect, Fiber, Schedule } from "effect";
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

/**
 * 后台索引编排的原语边界（Effect 程序）。
 * 每个操作返回 `Effect`，失败落 error 通道（而非 defect），使 `Effect.retry` 能按需重试。
 * 底层 lancedb / embedding 是阻塞 IO（`Effect.promise` 的 rejection 会变 defect）——
 * 因此统一用 `Effect.tryPromise` 把 rejection 映射为可重试的 typed Error。
 */
export type RetrievalIndexOperations = {
  reconcile(
    db: ReflectaDb,
    onProgress: (progress: RetrievalIndexProgress) => void,
  ): Effect.Effect<RetrievalIndexWorkResult, Error>;
  sync(
    db: ReflectaDb,
    understandingIds: string[],
    onProgress: (progress: RetrievalIndexProgress) => void,
  ): Effect.Effect<RetrievalIndexWorkResult, Error>;
  rebuild(
    db: ReflectaDb,
    onProgress: (progress: RetrievalIndexProgress) => void,
  ): Effect.Effect<RetrievalIndexWorkResult, Error>;
  isReady(): Effect.Effect<boolean>;
  optimize(): Effect.Effect<void, Error>;
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
    isReady: () =>
      Effect.tryPromise({
        try: () => createRetrievalIndex().isReady(),
        catch: () => false as never,
      }),
    optimize: () =>
      Effect.tryPromise({
        try: () => createRetrievalIndex().optimize(),
        catch: toError,
      }),
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * 后台检索索引协调器（Effect 原生内部实现，公开面不变）。
 * 状态机的"程序部分"用 Effect 表达：
 * - 每次 `kick`（running 空档且有活）`Effect.runFork` 一个受监督的 drain fiber，同步跑到首个 IO 挂起点；
 * - drain 循环按优先级（rebuild > reconcile > sync）逐批处理，直到无活；
 * - 每批 `Schedule.recurs(1)` 重试一次（`Effect.suspend` 惰性重建 work，使重试真正重新提交批次）——
 *   第二次失败记录 `lastError` 并中断本轮；
 * - `flush` 通过 idle `Deferred` 等待整轮清空，之后若仍有活（批内新到）自动续跑；
 * - `stop` 尽力中断当前 drain fiber。
 * 对外契约（start/enqueue/flush/rebuild/getStatus/stop + RetrievalIndexUpdateSink.enqueue）保持同步/异步不变。
 */
export class RetrievalIndexCoordinator implements RetrievalIndexUpdateSink {
  private readonly pendingIds = new Set<string>();
  private readonly operations: RetrievalIndexOperations;
  private readonly optimizeAfterOperations: number;
  private workerFiber?: Fiber.Fiber<void, never>;
  private reconcileRequested = false;
  private rebuildRequested = false;
  private stopped = false;
  private running = false;
  private modificationOperations = 0;
  private progress?: RetrievalIndexProgress;
  private lastError?: Error;
  private idleDeferred: Deferred.Deferred<void>;

  constructor(private readonly options: RetrievalIndexCoordinatorOptions) {
    this.operations = options.operations ?? defaultOperations();
    this.optimizeAfterOperations = options.optimizeAfterOperations ?? 20;
    this.idleDeferred = Effect.runSync(Deferred.make());
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
      const d = this.idleDeferred;
      this.kick();
      await Effect.runPromise(Deferred.await(d));
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
    if (!(await Effect.runPromise(this.operations.isReady())))
      return { ...base, state: "not_ready" };
    return { ...base, state: "ready" };
  }

  stop(): void {
    this.stopped = true;
    this.pendingIds.clear();
    this.reconcileRequested = false;
    this.rebuildRequested = false;
    // 尽力中断在途 drain fiber（底层阻塞 IO 本身不可取消，中断只停止后续编排）。
    if (this.workerFiber) {
      void Effect.runPromise(Fiber.interrupt(this.workerFiber)).catch(() => undefined);
    }
  }

  private hasWork = (): boolean =>
    this.rebuildRequested || this.reconcileRequested || this.pendingIds.size > 0;

  private kick = (): void => {
    if (this.stopped || this.running || !this.hasWork()) return;
    this.running = true;
    // runFork 同步跑到首个挂起点，使首批立即开始（与旧命令式行为一致、便于测试）。
    this.workerFiber = Effect.runFork(this.drainProgram());
  };

  /** drain 单个激活周期：逐批处理到无活，更新 idle 通报后若有新活自动续跑。 */
  private readonly drainProgram = (): Effect.Effect<void> =>
    this.drainLoop().pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          this.progress = undefined;
          this.running = false;
        }),
      ),
      Effect.flatMap(() => Deferred.succeed(this.idleDeferred, void 0)),
      Effect.flatMap(() =>
        Effect.sync(() => {
          this.idleDeferred = Effect.runSync(Deferred.make());
        }),
      ),
      Effect.flatMap(() =>
        Effect.sync(() => {
          // 批内新到的活：idle 通报后续跑（沿用“失败后若有待处理则开新轮”语义）。
          if (this.hasWork()) this.kick();
        }),
      ),
    );

  /** 递归 drain：直到无活或某批失败（Effect 运行时 trampoline，层数安全）。 */
  private readonly drainLoop = (): Effect.Effect<void> =>
    this.stopped || !this.hasWork()
      ? Effect.void
      : this.runOneBatch(this.selectWork()).pipe(
          Effect.flatMap((shouldContinue) => (shouldContinue ? this.drainLoop() : Effect.void)),
        );

  /** 按优先级（rebuild > reconcile > sync）取出下一批 work，并同步推进待处理状态。 */
  private readonly selectWork = (): (() => Effect.Effect<RetrievalIndexWorkResult, Error>) => {
    if (this.rebuildRequested) {
      this.rebuildRequested = false;
      this.reconcileRequested = false;
      this.pendingIds.clear();
      return () =>
        this.operations.rebuild(this.options.getDb(), (value) => (this.progress = value));
    }
    if (this.reconcileRequested) {
      this.reconcileRequested = false;
      return () =>
        this.operations.reconcile(this.options.getDb(), (value) => (this.progress = value));
    }
    const ids = [...this.pendingIds];
    this.pendingIds.clear();
    return () =>
      this.operations.sync(this.options.getDb(), ids, (value) => (this.progress = value));
  };

  /** 单个批：`Effect.suspend` 惰性重建 work，`Schedule.recurs(1)` 重试一次；成功记账，失败记录并中止本轮。 */
  private readonly runOneBatch = (
    work: () => Effect.Effect<RetrievalIndexWorkResult, Error>,
  ): Effect.Effect<boolean> =>
    Effect.suspend(() => work()).pipe(
      Effect.retry({ schedule: Schedule.recurs(1) }),
      Effect.matchEffect({
        onFailure: (error) => Effect.succeed(this.recordFailure(error)),
        onSuccess: (result) => this.optimizeIfNeeded(result),
      }),
    );

  private readonly optimizeIfNeeded = (
    result: RetrievalIndexWorkResult,
  ): Effect.Effect<boolean> => {
    this.lastError = undefined;
    this.modificationOperations += result.operationCount;
    if (this.modificationOperations < this.optimizeAfterOperations) return Effect.succeed(true);

    return this.operations.optimize().pipe(
      // optimize 失败不影响已提交数据：记 warn（走 Effect 日志管道），计数保留，留给下次更新重试
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.logWarning(
            "Retrieval index optimization failed; data remains searchable and maintenance will retry after the next update.",
            error,
          ),
        onSuccess: () =>
          Effect.sync(() => {
            this.modificationOperations = 0;
          }),
      }),
      Effect.as(true),
    );
  };

  private readonly recordFailure = (error: Error): boolean => {
    this.lastError = error instanceof Error ? error : new Error(String(error));
    return false;
  };
}
