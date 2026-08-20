import { Cause, Deferred, Effect, Exit, Option, Queue, Ref } from "effect";
import { markdownEquals } from "@reflecta/ui/editor/markdown-normalize";
import { renderError } from "@renderer/lib/errors";
import { useKeyPress, useMemoizedFn } from "ahooks";
import { useEffect, useRef, type RefObject } from "react";
import { useUpdateUnderstandingMutation } from "./queries";
import { appAtomRegistry } from "@renderer/lib/atoms";
import { captureActions, draftAtom, readCaptureState } from "./store";

export type DraftSaveSnapshot = {
  understandingId: string;
  title: string;
  body: string;
};

type DraftSaveResult = {
  updatedAt: string;
};

type DraftSaveQueueOptions<Result extends DraftSaveResult> = {
  save: (snapshot: DraftSaveSnapshot) => Promise<Result>;
  onStarted: (snapshot: DraftSaveSnapshot) => void;
  onSucceeded: (snapshot: DraftSaveSnapshot, result: Result) => void;
  onFailed: (snapshot: DraftSaveSnapshot, error: string) => void;
};

export function createDraftSaveQueue<Result extends DraftSaveResult>({
  save,
  onStarted,
  onSucceeded,
  onFailed,
}: DraftSaveQueueOptions<Result>) {
  type Task = {
    snapshot: DraftSaveSnapshot;
    rev: number;
    deferred: Deferred.Deferred<Result, unknown>;
  };

  const tasks: Queue.Queue<Task> = Effect.runSync(Queue.unbounded<Task>());
  const latestRevision: Ref.Ref<number> = Effect.runSync(Ref.make(0));

  // 单 worker fiber：串行保存；每个任务经 Deferred 把结果/错误回给调用方，
  // 回调（onSucceeded/onFailed）按最新 revision 门控，避免过期保存污染 UI。
  // 用 `Effect.exit` 捕获成败（v4 gen 中 JS try/catch 捕不到 `yield*` 的失败）。
  Effect.runFork(
    Effect.gen(function* () {
      while (true) {
        const task: Task = yield* Queue.take(tasks);
        const out = yield* Effect.exit(
          Effect.tryPromise<Result, Error>({
            try: () => save(task.snapshot),
            catch: (error) => error as Error,
          }),
        );
        if (Exit.isSuccess(out)) {
          if ((yield* Ref.get(latestRevision)) === task.rev) onSucceeded(task.snapshot, out.value);
          yield* Deferred.succeed(task.deferred, out.value);
        } else {
          const error = Cause.findErrorOption(out.cause).pipe(
            Option.getOrElse(() => new Error("保存失败")),
          );
          if ((yield* Ref.get(latestRevision)) === task.rev) {
            onFailed(task.snapshot, renderError(error));
          }
          yield* Deferred.fail(task.deferred, error);
        }
      }
    }),
  );

  return {
    save(snapshot: DraftSaveSnapshot): Promise<Result> {
      const rev = Effect.runSync(Ref.updateAndGet(latestRevision, (n) => n + 1));
      onStarted(snapshot);
      const deferred: Deferred.Deferred<Result, unknown> = Effect.runSync(
        Deferred.make<Result, unknown>(),
      );
      Effect.runSync(Queue.offer(tasks, { snapshot, rev, deferred }));
      return Effect.runPromise(Deferred.await(deferred));
    },
  };
}

type UseUnderstandingDraftSaveOptions = {
  understandingId: string;
  scopeRef?: RefObject<HTMLElement | null>;
};

export function useUnderstandingDraftSave({
  understandingId,
  scopeRef,
}: UseUnderstandingDraftSaveOptions) {
  const updateUnderstandingMutation = useUpdateUnderstandingMutation();
  const mutateAsyncRef = useRef(updateUnderstandingMutation.mutateAsync);
  const latestSnapshotRef = useRef<DraftSaveSnapshot | null>(null);
  const pendingSnapshotRef = useRef<DraftSaveSnapshot | null>(null);
  mutateAsyncRef.current = updateUnderstandingMutation.mutateAsync;

  const queueRef = useRef<ReturnType<typeof createDraftSaveQueue> | null>(null);
  if (!queueRef.current) {
    queueRef.current = createDraftSaveQueue({
      save: async (snapshot) => {
        const result = await mutateAsyncRef.current({
          id: snapshot.understandingId,
          input: {
            title: snapshot.title.trim() ? snapshot.title : null,
            body: snapshot.body,
          },
        });
        return { updatedAt: result.updatedAt };
      },
      onStarted: (snapshot) => {
        captureActions.markDraftSaveStarted(snapshot.understandingId);
      },
      onSucceeded: (snapshot, result) => {
        captureActions.markDraftSaveSucceeded({
          understandingId: snapshot.understandingId,
          title: snapshot.title,
          body: snapshot.body,
          savedAt: result.updatedAt,
        });
      },
      onFailed: (snapshot, error) => {
        captureActions.markDraftSaveFailed({
          understandingId: snapshot.understandingId,
          error,
        });
      },
    });
  }

  const saveDraft = useMemoizedFn((body?: string) => {
    const draft = readCaptureState(draftAtom);
    let snapshot =
      draft?.dirty && draft.understandingId === understandingId
        ? {
            understandingId: draft.understandingId,
            title: draft.title,
            body: draft.body,
          }
        : pendingSnapshotRef.current;
    if (body !== undefined) {
      const latest =
        draft?.understandingId === understandingId
          ? {
              understandingId: draft.understandingId,
              title: draft.title,
              body: draft.body,
            }
          : latestSnapshotRef.current;
      if (latest && (!snapshot || !markdownEquals(body, latest.body))) {
        snapshot = { ...latest, body };
      }
    }
    if (!snapshot) return Promise.resolve(undefined);

    return queueRef.current?.save(snapshot).catch(() => undefined);
  });

  useKeyPress(
    ["meta.s", "ctrl.s"],
    (event) => {
      event.preventDefault();
      void saveDraft();
    },
    { target: scopeRef, exactMatch: true },
  );

  useEffect(() => {
    const updatePendingSnapshot = () => {
      const draft = readCaptureState(draftAtom);
      if (draft?.understandingId !== understandingId) return;
      latestSnapshotRef.current = {
        understandingId: draft.understandingId,
        title: draft.title,
        body: draft.body,
      };
      pendingSnapshotRef.current = draft.dirty ? latestSnapshotRef.current : null;
    };
    updatePendingSnapshot();
    const unsubscribe = appAtomRegistry.subscribe(draftAtom, updatePendingSnapshot);

    return () => {
      unsubscribe();
      void saveDraft();
    };
  }, [understandingId, saveDraft]);

  return { saveDraft };
}
