import { useKeyPress, useMemoizedFn } from "ahooks";
import { useEffect, useRef, type RefObject } from "react";
import { useUpdateUnderstandingMutation } from "./queries";
import { useCaptureStore } from "./store";

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

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createDraftSaveQueue<Result extends DraftSaveResult>({
  save,
  onStarted,
  onSucceeded,
  onFailed,
}: DraftSaveQueueOptions<Result>) {
  let queue = Promise.resolve();
  let latestRevision = 0;

  return {
    save(snapshot: DraftSaveSnapshot): Promise<Result | undefined> {
      const revision = ++latestRevision;
      onStarted(snapshot);

      const result = queue.catch(() => undefined).then(() => save(snapshot));
      queue = result.then(
        () => undefined,
        () => undefined,
      );

      return result.then(
        (value) => {
          if (revision === latestRevision) onSucceeded(snapshot, value);
          return value;
        },
        (error: unknown) => {
          if (revision === latestRevision) onFailed(snapshot, messageForError(error));
          throw error;
        },
      );
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
        useCaptureStore.getState().markDraftSaveStarted(snapshot.understandingId);
      },
      onSucceeded: (snapshot, result) => {
        useCaptureStore.getState().markDraftSaveSucceeded({
          understandingId: snapshot.understandingId,
          title: snapshot.title,
          body: snapshot.body,
          savedAt: result.updatedAt,
        });
      },
      onFailed: (snapshot, error) => {
        useCaptureStore.getState().markDraftSaveFailed({
          understandingId: snapshot.understandingId,
          error,
        });
      },
    });
  }

  const saveDraft = useMemoizedFn(() => {
    const draft = useCaptureStore.getState().draft;
    if (!draft?.dirty || draft.understandingId !== understandingId)
      return Promise.resolve(undefined);

    return queueRef.current
      ?.save({
        understandingId: draft.understandingId,
        title: draft.title,
        body: draft.body,
      })
      .catch(() => undefined);
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
    return () => {
      void saveDraft();
    };
  }, [understandingId, saveDraft]);

  return { saveDraft };
}
