import { formatDiagnosticLogDate, type DiagnosticEventInput } from "./diagnostic-log";

// Aggregation follows the buffered dedup pattern from VS Code's
// BaseErrorTelemetry (MIT,
// https://github.com/microsoft/vscode/blob/e8db8ed8/src/vs/platform/telemetry/common/errorTelemetry.ts):
// repeated errors are counted by a stable fingerprint instead of flooding the
// log with identical lines, and the aggregated count is emitted as a
// diagnostic event.

export const ERROR_AGGREGATE_EVENT = "error.aggregate";
export const ERROR_AGGREGATE_MIN_COUNT = 3;
export const ERROR_AGGREGATE_FLUSH_INTERVAL_MS = 60_000;

type ErrorBucket = {
  date: string;
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  reported: boolean;
  sample: DiagnosticEventInput;
};

export type ErrorAggregatorOptions = {
  flushIntervalMs?: number;
  minCount?: number;
  write: (event: DiagnosticEventInput) => void;
  now?: () => Date;
};

function stringAttr(attrs: Record<string, unknown> | undefined, key: string): string {
  const value = attrs?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * Stable key for grouping repeats of the same failure. Variable data such as
 * stack frames is intentionally excluded so a single root cause stays in one
 * bucket regardless of rebuilds or changing line numbers.
 */
export function errorFingerprint(event: DiagnosticEventInput): string {
  const attrs = event.attrs;
  return [
    event.scope,
    event.event,
    stringAttr(attrs, "ipc.channel"),
    stringAttr(attrs, "source"),
    stringAttr(attrs, "error.name"),
    stringAttr(attrs, "error.message"),
  ].join("|");
}

export class ErrorAggregator {
  private readonly buckets = new Map<string, ErrorBucket>();
  private readonly flushIntervalMs: number;
  private readonly minCount: number;
  private readonly write: (event: DiagnosticEventInput) => void;
  private readonly now: () => Date;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: ErrorAggregatorOptions) {
    this.flushIntervalMs = options.flushIntervalMs ?? ERROR_AGGREGATE_FLUSH_INTERVAL_MS;
    this.minCount = options.minCount ?? ERROR_AGGREGATE_MIN_COUNT;
    this.write = options.write;
    this.now = options.now ?? (() => new Date());
  }

  observe(event: DiagnosticEventInput): void {
    if (event.level !== "error" || event.event === ERROR_AGGREGATE_EVENT) return;
    const now = this.now();
    const date = formatDiagnosticLogDate(now);
    const fingerprint = errorFingerprint(event);
    const key = `${date}|${fingerprint}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        date,
        fingerprint,
        count: 0,
        firstSeen: now.toISOString(),
        lastSeen: now.toISOString(),
        reported: false,
        sample: event,
      };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.lastSeen = now.toISOString();
  }

  flush(): void {
    const today = formatDiagnosticLogDate(this.now());
    const toEmit: ErrorBucket[] = [];
    const toRemove: string[] = [];
    for (const [key, bucket] of this.buckets) {
      if (bucket.date !== today) {
        // A finished day can never grow again: write its final total once.
        if (bucket.count >= this.minCount) toEmit.push(bucket);
        toRemove.push(key);
      } else if (bucket.count >= this.minCount && !bucket.reported) {
        toEmit.push(bucket);
      }
    }
    for (const bucket of toEmit) {
      this.emitAggregate(bucket);
      // Today's buckets: reported prevents re-emitting on later flushes.
      // Finished-day buckets are removed right after regardless.
      bucket.reported = true;
    }
    for (const key of toRemove) {
      this.buckets.delete(key);
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private emitAggregate(bucket: ErrorBucket): void {
    const { date, fingerprint, count, firstSeen, lastSeen, sample } = bucket;
    this.write({
      level: "error",
      event: ERROR_AGGREGATE_EVENT,
      scope: "app",
      message: ERROR_AGGREGATE_EVENT,
      attrs: {
        "error.date": date,
        "error.fingerprint": fingerprint,
        "error.event": sample.event,
        "error.scope": sample.scope,
        "error.count": count,
        "error.firstSeen": firstSeen,
        "error.lastSeen": lastSeen,
        ...sample.attrs,
      },
    });
  }
}
