import { powerMonitor } from "electron";
import {
  isRetrievalIndexDirty,
  rebuildRetrievalIndexWithStatus,
  type ReflectaDb,
} from "@reflecta/server";
import { getDBInstance } from "./db";

type IdleState = "active" | "idle" | "locked" | "unknown";

type RetrievalIdleRebuildOptions = {
  intervalMs?: number;
  idleThresholdSeconds?: number;
  getIdleState: (idleThresholdSeconds: number) => IdleState;
  isDirty: () => Promise<boolean>;
  rebuild: () => Promise<void>;
};

export function createRetrievalIdleRebuilder(options: RetrievalIdleRebuildOptions) {
  const intervalMs = options.intervalMs ?? 30_000;
  const idleThresholdSeconds = options.idleThresholdSeconds ?? 60;
  let running = false;
  let stopped = false;

  const trigger = async () => {
    if (running || stopped) return;
    const idleState = options.getIdleState(idleThresholdSeconds);
    if (idleState !== "idle" && idleState !== "locked") return;

    running = true;
    try {
      if (await options.isDirty()) await options.rebuild();
    } catch {
      // ponytail: rebuild status already records failures; idle polling will retry later.
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void trigger(), intervalMs);
  timer.unref?.();

  return {
    trigger,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export function startRetrievalIdleRebuild(db: () => ReflectaDb = getDBInstance) {
  return createRetrievalIdleRebuilder({
    getIdleState: (idleThresholdSeconds) => powerMonitor.getSystemIdleState(idleThresholdSeconds),
    isDirty: isRetrievalIndexDirty,
    rebuild: () => rebuildRetrievalIndexWithStatus(db()),
  });
}
