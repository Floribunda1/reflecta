import {
  isRetrievalIndexDirty,
  subscribeRetrievalIndexDirty,
  syncDirtyRetrievalIndexWithStatus,
  type ReflectaDb,
} from "@reflecta/server";
import { getDBInstance } from "./db";

type RetrievalIndexSchedulerOptions = {
  debounceMs?: number;
  maxWaitMs?: number;
  recoveryIntervalMs?: number;
  isDirty: () => Promise<boolean>;
  rebuild: () => Promise<void>;
  subscribe?: (listener: () => void) => () => void;
};

export function createRetrievalIndexScheduler(options: RetrievalIndexSchedulerOptions) {
  const debounceMs = options.debounceMs ?? 2_000;
  const maxWaitMs = options.maxWaitMs ?? 10_000;
  const recoveryIntervalMs = options.recoveryIntervalMs ?? 30_000;
  let pendingSince: number | undefined;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let rerunRequested = false;
  let stopped = false;

  const clearPendingTimer = () => {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = undefined;
  };

  const run = async () => {
    clearPendingTimer();
    pendingSince = undefined;
    if (stopped) return;
    if (running) {
      rerunRequested = true;
      return;
    }

    running = true;
    let succeeded = false;
    try {
      if (await options.isDirty()) await options.rebuild();
      succeeded = true;
    } catch {
      // The recovery timer retries. Retrieval status already exposes the failure.
    } finally {
      running = false;
      const shouldRerun = rerunRequested;
      rerunRequested = false;
      if (succeeded && shouldRerun) {
        notify();
      } else if (!succeeded) {
        clearPendingTimer();
        pendingSince = undefined;
      }
    }
  };

  const notify = () => {
    if (stopped) return;
    const now = Date.now();
    pendingSince ??= now;
    const remainingMaxWait = Math.max(0, maxWaitMs - (now - pendingSince));
    const delay = Math.min(debounceMs, remainingMaxWait);
    clearPendingTimer();
    pendingTimer = setTimeout(() => void run(), delay);
    pendingTimer.unref?.();
  };

  const recover = async () => {
    if (stopped || running || pendingTimer) return;
    try {
      if (await options.isDirty()) notify();
    } catch {
      // A later recovery tick will retry.
    }
  };

  const unsubscribe = options.subscribe?.(notify);
  const recoveryTimer = setInterval(() => void recover(), recoveryIntervalMs);
  recoveryTimer.unref?.();
  void recover();

  return {
    notify,
    trigger: run,
    stop() {
      stopped = true;
      clearPendingTimer();
      clearInterval(recoveryTimer);
      unsubscribe?.();
    },
  };
}

export function startRetrievalIndexScheduler(db: () => ReflectaDb = getDBInstance) {
  return createRetrievalIndexScheduler({
    isDirty: isRetrievalIndexDirty,
    rebuild: () => syncDirtyRetrievalIndexWithStatus(db()),
    subscribe: subscribeRetrievalIndexDirty,
  });
}
