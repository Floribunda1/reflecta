import log from "electron-log/main";
import path from "node:path";
import { app, crashReporter, ipcMain } from "electron";
import { format } from "node:util";
import { Context, Logger, References } from "effect";
import type {
  DiagnosticContext,
  DiagnosticLevel,
  DiagnosticScope,
  DiagnosticEventInput,
} from "./diagnostic-log";
import { DiagnosticLog, diagnosticErrorAttrs } from "./diagnostic-log";
import { ErrorAggregator } from "./error-aggregator";
import { getAppConfigDir, getReflectaProfile } from "./config";

export const APP_NAME = "Reflecta";
const DEV_LOG_APP_NAME = "Reflecta Dev";
export const DIAGNOSTIC_RENDERER_ERROR_CHANNEL = "diagnostic:renderer-error";
let initialized = false;
let diagnosticLog: DiagnosticLog | undefined;
let diagnosticLogRoot: string | undefined;

function isDevRuntime() {
  return process.env.NODE_ENV === "development" || Boolean(process.env.VITE_DEV_SERVER_URL);
}

export function getLogFilePath() {
  return getDiagnosticLog().getCurrentLogFilePath();
}

export function getLogAppName() {
  return getReflectaProfile() === "dev" ? DEV_LOG_APP_NAME : APP_NAME;
}

function getDiagnosticLog(): DiagnosticLog {
  const root = getSafeDiagnosticLogRoot();
  if (!diagnosticLog || diagnosticLogRoot !== root) {
    diagnosticLogRoot = root;
    diagnosticLog = new DiagnosticLog({ logStorageRoot: root });
  }
  return diagnosticLog;
}

function getSafeDiagnosticLogRoot(): string {
  try {
    return getAppConfigDir();
  } catch {
    return getFallbackDiagnosticLogRoot();
  }
}

function getFallbackDiagnosticLogRoot(): string {
  try {
    return app.getPath("userData");
  } catch {
    return process.cwd();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function diagnosticLevel(level: string): DiagnosticLevel {
  if (level === "error" || level === "warn" || level === "debug") return level;
  return "info";
}

function configuredLogLevel(): DiagnosticLevel {
  const configured = process.env.REFLECTA_LOG_LEVEL?.toLowerCase();
  if (
    configured === "debug" ||
    configured === "info" ||
    configured === "warn" ||
    configured === "error"
  ) {
    return configured;
  }
  return isDevRuntime() ? "debug" : "info";
}

const LOG_LEVEL_ORDER: Record<DiagnosticLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function diagnosticScope(scope: string | undefined): DiagnosticScope {
  if (
    scope === "app" ||
    scope === "ipc" ||
    scope === "db" ||
    scope === "agent" ||
    scope === "retrieval" ||
    scope === "renderer"
  ) {
    return scope;
  }
  return "app";
}

function attrsFromData(data: unknown[]): Record<string, unknown> | undefined {
  if (data.length === 0) return undefined;
  if (data.length === 1 && isRecord(data[0])) return data[0];
  return { data };
}

const diagnosticEventListeners = new Set<(event: DiagnosticEventInput) => void>();

/**
 * Subscribe to every event flowing through the diagnostic outlet. This is the
 * telemetry seam: aggregation, remote forwarding and future sinks attach here
 * without touching any call site. Returns an unsubscribe function.
 */
export function onDiagnosticEvent(listener: (event: DiagnosticEventInput) => void): () => void {
  diagnosticEventListeners.add(listener);
  return () => diagnosticEventListeners.delete(listener);
}

export function writeDiagnosticEvent(event: DiagnosticEventInput): void {
  if (LOG_LEVEL_ORDER[event.level] < LOG_LEVEL_ORDER[configuredLogLevel()]) return;
  try {
    getDiagnosticLog().write(event);
  } catch {
    // Logging must never become the crash path.
  }
  for (const listener of diagnosticEventListeners) {
    try {
      listener(event);
    } catch {
      // Observers must never break logging.
    }
  }
}

export function writeFallbackError(
  source: string,
  error?: unknown,
  attrs: Record<string, unknown> = {},
): void {
  writeDiagnosticEvent({
    level: "error",
    event: "app.fallback.error",
    scope: "app",
    message: `Fallback captured ${source}`,
    attrs: {
      source,
      ...attrs,
      ...(error === undefined ? {} : diagnosticErrorAttrs(error)),
    },
  });
}

function installFallbackErrorLogging() {
  process.on("uncaughtExceptionMonitor", (error) => {
    writeFallbackError("uncaughtException", error);
  });
  process.on("unhandledRejection", (reason) => {
    writeFallbackError("unhandledRejection", reason);
  });
  app.on("render-process-gone", (_event, webContents, details) => {
    writeFallbackError("render-process-gone", undefined, {
      webContentsId: webContents.id,
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });
  app.on("child-process-gone", (_event, details) => {
    writeFallbackError("child-process-gone", undefined, {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName,
      name: details.name,
    });
  });
}

// Collect native crashes (Crashpad minidumps) locally. No upload happens until
// a telemetry decision is made; `uploadToServer: false` keeps reports on disk
// under the app config dir.
function installNativeCrashCollection(): void {
  try {
    app.setPath("crashDumps", path.join(getAppConfigDir(), "crash-dumps"));
    crashReporter.start({
      productName: APP_NAME,
      uploadToServer: false,
      compress: true,
      extra: {
        profile: getReflectaProfile(),
        version: app.getVersion(),
      },
    });
  } catch {
    // Crash reporting must never block startup.
  }
}

function rendererErrorAttrs(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return { source: "renderer", payloadType: typeof payload };
  }
  const {
    source,
    message,
    args,
    detail,
    stack,
    componentStack,
    filename,
    lineno,
    colno,
    href,
    userAgent,
    ...extra
  } = payload;
  return {
    source: typeof source === "string" ? source : "renderer",
    message:
      source === "console.error" && Array.isArray(args)
        ? format(...args)
        : typeof message === "string"
          ? message
          : undefined,
    detail: Array.isArray(detail) ? detail : undefined,
    stack: typeof stack === "string" ? stack : undefined,
    componentStack: typeof componentStack === "string" ? componentStack : undefined,
    filename: typeof filename === "string" ? filename : undefined,
    lineno: typeof lineno === "number" ? lineno : undefined,
    colno: typeof colno === "number" ? colno : undefined,
    href: typeof href === "string" ? href : undefined,
    userAgent: typeof userAgent === "string" ? userAgent : undefined,
    ...extra,
  };
}

function installRendererErrorLogging() {
  ipcMain.on(DIAGNOSTIC_RENDERER_ERROR_CHANNEL, (_event, payload) => {
    writeDiagnosticEvent({
      level: "error",
      event: "renderer.error",
      scope: "renderer",
      attrs: rendererErrorAttrs(payload),
    });
  });
}

// Prefix logging follows the Logger wrapper pattern from Mattermost Desktop
// (Apache-2.0, https://github.com/mattermost/desktop/blob/master/src/common/log.ts):
// a scope logger can be narrowed with `withPrefix(...)` so every entry carries
// module / instance context in the human-readable message while the machine
// readable `event` name stays clean for grouping.
const PREFIX_MAX_LENGTH = 20;

export function shortenPrefix(value: string): string {
  if (value.length < PREFIX_MAX_LENGTH) return value;
  return `${value.slice(0, PREFIX_MAX_LENGTH - 3)}...`;
}

export class DiagnosticLogger {
  private readonly prefixes: readonly string[];

  constructor(
    private readonly scope: DiagnosticScope,
    ...prefixes: string[]
  ) {
    this.prefixes = prefixes;
  }

  withPrefix(...prefixes: string[]): DiagnosticLogger {
    return new DiagnosticLogger(this.scope, ...this.prefixes, ...prefixes);
  }

  debug(eventName: string, ...data: unknown[]): void {
    this.write("debug", eventName, ...data);
  }

  error(eventName: string, ...data: unknown[]): void {
    this.write("error", eventName, ...data);
  }

  info(eventName: string, ...data: unknown[]): void {
    this.write("info", eventName, ...data);
  }

  warn(eventName: string, ...data: unknown[]): void {
    this.write("warn", eventName, ...data);
  }

  private write(level: DiagnosticLevel, eventName: string, ...data: unknown[]): void {
    writeDiagnosticEvent({
      level,
      event: eventName,
      scope: this.scope,
      message: this.formatMessage(eventName),
      attrs: attrsFromData(data),
    });
  }

  private formatMessage(eventName: string): string {
    if (this.prefixes.length === 0) return eventName;
    const prefixText = this.prefixes.map((prefix) => `[${shortenPrefix(prefix)}]`).join(" ");
    return `${prefixText} ${eventName}`;
  }
}

const EFFECT_LOG_PAYLOAD = Symbol("reflecta.effect-log-payload");

type EffectLogPayload = {
  [EFFECT_LOG_PAYLOAD]: true;
  context?: DiagnosticContext;
  attrs?: Record<string, unknown>;
};

function effectLogPayload(data: unknown[]): EffectLogPayload | undefined {
  if (data.length !== 1 || !isRecord(data[0])) return undefined;
  const value = data[0] as Record<PropertyKey, unknown>;
  return value[EFFECT_LOG_PAYLOAD] === true ? (value as EffectLogPayload) : undefined;
}

function createElectronDiagnosticTransport(level: DiagnosticLevel) {
  const transport = Object.assign(
    (message: { data: unknown[]; date: Date; level: string; scope?: string }) => {
      const [first, ...rest] = message.data;
      const eventName = typeof first === "string" ? first : "electron.log";
      const scope = diagnosticScope(message.scope);
      const payload = effectLogPayload(typeof first === "string" ? rest : message.data);
      writeDiagnosticEvent({
        ts: message.date.toISOString(),
        level: diagnosticLevel(message.level),
        event: eventName.startsWith(`${scope}.`) ? eventName : `${scope}.${eventName}`,
        scope,
        message: eventName,
        context: payload?.context,
        attrs: payload?.attrs ?? attrsFromData(typeof first === "string" ? rest : message.data),
      });
    },
    { level, transforms: [] },
  );
  return transport;
}

const EFFECT_CONTEXT_KEYS = [
  "requestId",
  "traceId",
  "sessionId",
  "runId",
  "messageId",
  "toolCallId",
] as const;

const effectLogger = Logger.make<unknown, void>((options) => {
  const entry = Logger.formatStructured.log(options);
  const annotations = { ...entry.annotations };
  const scope = diagnosticScope(
    typeof annotations.scope === "string" ? annotations.scope : undefined,
  );
  delete annotations.scope;
  const context: DiagnosticContext = {};
  for (const key of EFFECT_CONTEXT_KEYS) {
    if (typeof annotations[key] === "string") context[key] = annotations[key];
    delete annotations[key];
  }
  const eventName = typeof entry.message === "string" ? entry.message : "effect.log";
  const attrs: Record<string, unknown> = {
    ...annotations,
    ...entry.spans,
    ...(typeof entry.message === "string" ? {} : { data: entry.message }),
    ...(entry.cause ? { "error.cause": entry.cause } : {}),
  };
  const payload: EffectLogPayload = {
    [EFFECT_LOG_PAYLOAD]: true,
    context: Object.keys(context).length > 0 ? context : undefined,
    attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
  };
  const scoped = log.scope(scope);
  if (entry.level === "DEBUG" || entry.level === "TRACE") scoped.debug(eventName, payload);
  else if (entry.level === "WARN") scoped.warn(eventName, payload);
  else if (entry.level === "ERROR" || entry.level === "FATAL") scoped.error(eventName, payload);
  else scoped.info(eventName, payload);
});

export function getEffectLoggingContext() {
  const level = configuredLogLevel();
  return Context.empty().pipe(
    Context.add(Logger.CurrentLoggers, new Set([effectLogger])),
    Context.add(
      References.MinimumLogLevel,
      level === "debug"
        ? "Debug"
        : level === "warn"
          ? "Warn"
          : level === "error"
            ? "Error"
            : "Info",
    ),
  );
}

let errorAggregator: ErrorAggregator | undefined;

/** Flush aggregated error counts to the diagnostic log (also called on quit). */
export function flushErrorAggregates(): void {
  errorAggregator?.flush();
}

export function initializeLogging() {
  if (initialized) return;
  initialized = true;

  const level = configuredLogLevel();
  log.initialize({ preload: false, spyRendererConsole: false });
  log.scope.labelPadding = false;
  log.transports.file.level = false;
  log.transports.file.setAppName(getLogAppName());
  log.transports.console.level = level;
  log.transports.console.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {level}{scope} {text}";
  log.transports.diagnostic = createElectronDiagnosticTransport(level);
  log.errorHandler.startCatching({ showDialog: false });
  log.eventLogger.startLogging({ level: "warn", scope: "electron" });
  installFallbackErrorLogging();
  installRendererErrorLogging();
  if (app.isPackaged) {
    installNativeCrashCollection();
  }

  errorAggregator = new ErrorAggregator({ write: writeDiagnosticEvent });
  errorAggregator.start();
  onDiagnosticEvent((event) => errorAggregator?.observe(event));
  app.on("before-quit", () => errorAggregator?.flush());

  writeDiagnosticEvent({
    level: "info",
    event: "app.logging.initialized",
    scope: "app",
    message: "Logging initialized",
    attrs: {
      version: app.getVersion(),
      file: getLogFilePath(),
      appName: APP_NAME,
      logAppName: getLogAppName(),
      profile: getReflectaProfile(),
      mode: isDevRuntime() ? "development" : "production",
    },
  });
}

export const appLog = new DiagnosticLogger("app");
export const agentLog = new DiagnosticLogger("agent");
export const ipcLog = new DiagnosticLogger("ipc");
