import fs from "node:fs";
import path from "node:path";

export type DiagnosticLevel = "debug" | "info" | "warn" | "error";
export type DiagnosticScope = "app" | "ipc" | "db" | "agent" | "retrieval" | "renderer";

export type DiagnosticContext = {
  requestId?: string;
  traceId?: string;
  sessionId?: string;
  runId?: string;
  messageId?: string;
  toolCallId?: string;
};

export type DiagnosticEvent = {
  ts: string;
  level: DiagnosticLevel;
  event: string;
  scope: DiagnosticScope;
  message?: string;
  context?: DiagnosticContext;
  attrs?: Record<string, unknown>;
};

export type DiagnosticEventInput = Omit<DiagnosticEvent, "ts"> & { ts?: string };

export const DIAGNOSTIC_LOG_MAX_BYTES = 5 * 1024 * 1024;
export const DIAGNOSTIC_LOG_RETENTION_DAYS = 30;

const REDACTED = "[redacted]";
const SECRET_KEY_PATTERN = /(?:api[-_]?key|token|authorization|password|secret)/i;
const LOG_FILE_PATTERN = /^reflecta-(\d{4}-\d{2}-\d{2})(?:\.\d+)?\.jsonl$/;

type DiagnosticLogOptions = {
  contentStorageRoot: string;
  maxFileBytes?: number;
  retentionDays?: number;
  now?: () => Date;
  throwOnWriteError?: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDiagnosticLogDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getDiagnosticLogsDir(contentStorageRoot: string): string {
  return path.join(contentStorageRoot, "logs");
}

export function getDiagnosticLogFilePath(contentStorageRoot: string, date = new Date()): string {
  return path.join(
    getDiagnosticLogsDir(contentStorageRoot),
    `reflecta-${formatDiagnosticLogDate(date)}.jsonl`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return value;
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  if (!isRecord(value)) return String(value);
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redactValue(item, seen);
  }
  seen.delete(value);
  return output;
}

export function redactDiagnosticEvent(event: DiagnosticEvent): DiagnosticEvent {
  return redactValue(event) as DiagnosticEvent;
}

export function diagnosticErrorAttrs(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      "error.name": error.name,
      "error.message": error.message,
      "error.stack": error.stack,
    };
  }
  if (isRecord(error)) {
    return {
      "error.name": typeof error.name === "string" ? error.name : undefined,
      "error.code": typeof error.code === "string" ? error.code : undefined,
      "error.message": typeof error.message === "string" ? error.message : JSON.stringify(error),
      "error.stack": typeof error.stack === "string" ? error.stack : undefined,
    };
  }
  return { "error.message": String(error) };
}

function compactRecord<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function localDateMinusDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - days);
  return formatDiagnosticLogDate(next);
}

export class DiagnosticLog {
  private readonly maxFileBytes: number;
  private readonly retentionDays: number;
  private readonly now: () => Date;
  private readonly throwOnWriteError: boolean;

  constructor(private readonly options: DiagnosticLogOptions) {
    this.maxFileBytes = options.maxFileBytes ?? DIAGNOSTIC_LOG_MAX_BYTES;
    this.retentionDays = options.retentionDays ?? DIAGNOSTIC_LOG_RETENTION_DAYS;
    this.now = options.now ?? (() => new Date());
    this.throwOnWriteError = options.throwOnWriteError ?? false;
  }

  get logsDir(): string {
    return getDiagnosticLogsDir(this.options.contentStorageRoot);
  }

  getCurrentLogFilePath(date = this.now()): string {
    return getDiagnosticLogFilePath(this.options.contentStorageRoot, date);
  }

  write(input: DiagnosticEventInput): void {
    try {
      const date = this.now();
      const event = redactDiagnosticEvent(
        compactRecord({
          ts: input.ts ?? date.toISOString(),
          level: input.level,
          event: input.event,
          scope: input.scope,
          message: input.message,
          context: input.context ? compactRecord(input.context) : undefined,
          attrs: input.attrs,
        }) as DiagnosticEvent,
      );
      const line = `${JSON.stringify(event)}\n`;
      fs.mkdirSync(this.logsDir, { recursive: true });
      this.prune(date);
      fs.appendFileSync(this.resolveWritableFile(date, Buffer.byteLength(line)), line, "utf8");
    } catch (error) {
      if (this.throwOnWriteError) throw error;
    }
  }

  private resolveWritableFile(date: Date, lineBytes: number): string {
    const day = formatDiagnosticLogDate(date);
    for (let suffix = 0; ; suffix += 1) {
      const fileName = suffix === 0 ? `reflecta-${day}.jsonl` : `reflecta-${day}.${suffix}.jsonl`;
      const filePath = path.join(this.logsDir, fileName);
      if (!fs.existsSync(filePath)) return filePath;
      if (fs.statSync(filePath).size + lineBytes <= this.maxFileBytes) return filePath;
    }
  }

  private prune(date: Date): void {
    if (this.retentionDays <= 0 || !fs.existsSync(this.logsDir)) return;
    const cutoff = localDateMinusDays(date, this.retentionDays - 1);
    for (const fileName of fs.readdirSync(this.logsDir)) {
      const match = fileName.match(LOG_FILE_PATTERN);
      if (match && match[1] < cutoff) {
        fs.rmSync(path.join(this.logsDir, fileName), { force: true });
      }
    }
  }
}
