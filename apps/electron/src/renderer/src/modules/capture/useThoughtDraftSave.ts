import { useKeyPress, useMemoizedFn } from "ahooks";
import { useEffect, useRef, type RefObject } from "react";
import { useUpdateThoughtMutation } from "./queries";
import { useCaptureStore } from "./store";

export type DraftSaveSnapshot = {
  thoughtId: string;
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

type UseThoughtDraftSaveOptions = {
  thoughtId: string;
  scopeRef?: RefObject<HTMLElement | null>;
};

export function useThoughtDraftSave({ thoughtId, scopeRef }: UseThoughtDraftSaveOptions) {
  const updateThoughtMutation = useUpdateThoughtMutation();
  const mutateAsyncRef = useRef(updateThoughtMutation.mutateAsync);
  mutateAsyncRef.current = updateThoughtMutation.mutateAsync;

  const queueRef = useRef<ReturnType<typeof createDraftSaveQueue> | null>(null);
  if (!queueRef.current) {
    queueRef.current = createDraftSaveQueue({
      save: async (snapshot) => {
        const result = await mutateAsyncRef.current({
          id: snapshot.thoughtId,
          input: {
            title: snapshot.title.trim() ? snapshot.title : null,
            body: snapshot.body,
          },
        });
        return { updatedAt: result.updatedAt };
      },
      onStarted: (snapshot) => {
        useCaptureStore.getState().markDraftSaveStarted(snapshot.thoughtId);
      },
      onSucceeded: (snapshot, result) => {
        useCaptureStore.getState().markDraftSaveSucceeded({
          thoughtId: snapshot.thoughtId,
          title: snapshot.title,
          body: snapshot.body,
          savedAt: result.updatedAt,
        });
      },
      onFailed: (snapshot, error) => {
        useCaptureStore.getState().markDraftSaveFailed({
          thoughtId: snapshot.thoughtId,
          error,
        });
      },
    });
  }

  const saveDraft = useMemoizedFn(() => {
    const draft = useCaptureStore.getState().draft;
    if (!draft?.dirty || draft.thoughtId !== thoughtId) return Promise.resolve(undefined);

    return queueRef.current
      ?.save({
        thoughtId: draft.thoughtId,
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
  }, [thoughtId, saveDraft]);

  return { saveDraft };
}
