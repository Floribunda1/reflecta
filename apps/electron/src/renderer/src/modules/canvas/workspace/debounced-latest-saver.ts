export type SaveStatus = "clean" | "dirty" | "saving" | "error";

export function createDebouncedLatestSaver<T>({
  delay,
  save,
  onStatus = () => {},
}: {
  delay: number;
  save: (value: T) => Promise<unknown>;
  onStatus?: (status: SaveStatus) => void;
}) {
  let latest: T | undefined;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const persist = async (value: T, savingRevision: number) => {
    if (savingRevision === revision) onStatus("saving");
    try {
      await save(value);
      if (savingRevision === revision) onStatus("clean");
    } catch {
      if (savingRevision === revision) onStatus("error");
    }
  };

  const schedule = (value: T) => {
    latest = value;
    const savingRevision = ++revision;
    onStatus("dirty");
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void persist(value, savingRevision);
    }, delay);
  };

  return {
    schedule,
    retry: () => (latest === undefined ? Promise.resolve() : persist(latest, revision)),
    flush: () => {
      if (!timer || latest === undefined) return Promise.resolve();
      clearTimeout(timer);
      timer = undefined;
      return persist(latest, revision);
    },
  };
}
