import path from "node:path";
import log from "electron-log/main";
import { app, crashReporter, ipcMain } from "electron";
import type { DiagnosticLevel, DiagnosticScope, DiagnosticEventInput } from "./diagnostic-log";
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

export function writeDiagnosticEvent(event: DiagnosticEventInput): void {
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
  return {
    source: typeof payload.source === "string" ? payload.source : "renderer",
    message: typeof payload.message === "string" ? payload.message : undefined,
    stack: typeof payload.stack === "string" ? payload.stack : undefined,
    componentStack: typeof payload.componentStack === "string" ? payload.componentStack : undefined,
    filename: typeof payload.filename === "string" ? payload.filename : undefined,
    lineno: typeof payload.lineno === "number" ? payload.lineno : undefined,
    colno: typeof payload.colno === "number" ? payload.colno : undefined,
    href: typeof payload.href === "string" ? payload.href : undefined,
    userAgent: typeof payload.userAgent === "string" ? payload.userAgent : undefined,
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

function createElectronDiagnosticTransport() {
  const transport = Object.assign(
    (message: { data: unknown[]; date: Date; level: string; scope?: string }) => {
      const [first, ...rest] = message.data;
      const eventName = typeof first === "string" ? first : "electron.log";
      const scope = diagnosticScope(message.scope);
      writeDiagnosticEvent({
        ts: message.date.toISOString(),
        level: diagnosticLevel(message.level),
        event: eventName.startsWith(`${scope}.`) ? eventName : `${scope}.${eventName}`,
        scope,
        message: eventName,
        attrs: attrsFromData(typeof first === "string" ? rest : message.data),
      });
    },
    { level: "debug" as const, transforms: [] },
  );
  return transport;
}

let errorAggregator: ErrorAggregator | undefined;

/** Flush aggregated error counts to the diagnostic log (also called on quit). */
export function flushErrorAggregates(): void {
  errorAggregator?.flush();
}

export function initializeLogging() {
  if (initialized) return;
  initialized = true;

  log.initialize({ preload: false, spyRendererConsole: false });
  log.scope.labelPadding = false;
  log.transports.file.level = false;
  log.transports.file.setAppName(getLogAppName());
  log.transports.console.level = isDevRuntime() ? "debug" : "info";
  log.transports.console.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {level}{scope} {text}";
  log.transports.diagnostic = createElectronDiagnosticTransport();
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
