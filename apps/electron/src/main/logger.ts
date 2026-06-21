import log from "electron-log/main";
import { getReflectaProfile } from "./config";

export const APP_NAME = "Reflecta";
const DEV_LOG_APP_NAME = "Reflecta Dev";
let initialized = false;

function isDevRuntime() {
  return process.env.NODE_ENV === "development" || Boolean(process.env.VITE_DEV_SERVER_URL);
}

export function getLogFilePath() {
  return log.transports.file.getFile().path;
}

export function getLogAppName() {
  return getReflectaProfile() === "dev" ? DEV_LOG_APP_NAME : APP_NAME;
}

export function initializeLogging() {
  if (initialized) return;
  initialized = true;

  log.initialize({ preload: false, spyRendererConsole: false });
  log.scope.labelPadding = false;
  log.transports.file.level = "debug";
  log.transports.file.setAppName(getLogAppName());
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {level}{scope} {text}";
  log.transports.console.level = isDevRuntime() ? "debug" : "info";
  log.transports.console.format = log.transports.file.format;
  log.errorHandler.startCatching({ showDialog: false });
  log.eventLogger.startLogging({ level: "warn", scope: "electron" });

  log.scope("app").info("logging.initialized", {
    file: getLogFilePath(),
    appName: APP_NAME,
    logAppName: getLogAppName(),
    profile: getReflectaProfile(),
    mode: isDevRuntime() ? "development" : "production",
  });
}

export const appLog = log.scope("app");
export const agentLog = log.scope("agent");
export const ipcLog = log.scope("ipc");
