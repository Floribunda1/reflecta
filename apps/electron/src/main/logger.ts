import log from "electron-log/main";
import { app, ipcMain } from "electron";
import type { DiagnosticLevel, DiagnosticScope, DiagnosticEventInput } from "./diagnostic-log";
import { DiagnosticLog, diagnosticErrorAttrs } from "./diagnostic-log";
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

function createScopedLog(scope: DiagnosticScope) {
  const write = (level: DiagnosticLevel, eventName: string, ...data: unknown[]) => {
    writeDiagnosticEvent({
      level,
      event: eventName,
      scope,
      message: eventName,
      attrs: attrsFromData(data),
    });
  };
  return {
    debug: (eventName: string, ...data: unknown[]) => write("debug", eventName, ...data),
    error: (eventName: string, ...data: unknown[]) => write("error", eventName, ...data),
    info: (eventName: string, ...data: unknown[]) => write("info", eventName, ...data),
    warn: (eventName: string, ...data: unknown[]) => write("warn", eventName, ...data),
  };
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

export const appLog = createScopedLog("app");
export const agentLog = createScopedLog("agent");
export const ipcLog = createScopedLog("ipc");
