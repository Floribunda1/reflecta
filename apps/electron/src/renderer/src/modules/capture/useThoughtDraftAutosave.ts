import { useEffect, useRef } from "react";
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
    save(snapshot: DraftSaveSnapshot): Promise<Result> {
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

export function useThoughtDraftAutosave() {
  const draft = useCaptureStore((state) => state.draft);
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

  useEffect(() => {
    if (!draft?.dirty) return;

    const snapshot: DraftSaveSnapshot = {
      thoughtId: draft.thoughtId,
      title: draft.title,
      body: draft.body,
    };
    const timer = window.setTimeout(() => {
      void queueRef.current?.save(snapshot).catch(() => undefined);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [draft?.thoughtId, draft?.title, draft?.body, draft?.dirty]);
}
