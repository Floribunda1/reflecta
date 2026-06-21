type LogLevel = "error" | "warn" | "info" | "verbose" | "debug" | "silly";

type ElectronLogBridge = Record<LogLevel | "log", (...data: unknown[]) => void>;

type Logger = Record<LogLevel | "log", (...data: unknown[]) => void>;

const isTest = import.meta.env.MODE === "test";

function electronLogBridge() {
  return typeof window === "undefined"
    ? undefined
    : (window as Window & { __electronLog?: ElectronLogBridge }).__electronLog;
}

function consoleLog(level: LogLevel | "log", scope: string, data: unknown[]) {
  if (level === "silly" || level === "verbose") return;
  const method = level === "log" ? "info" : level;
  console[method](`[${scope}]`, ...data);
}

export function loggerFor(scope: string): Logger {
  const write = (level: LogLevel | "log", ...data: unknown[]) => {
    if (isTest) return;
    const bridge = electronLogBridge();
    if (bridge) {
      bridge[level](`[${scope}]`, ...data);
      return;
    }
    consoleLog(level, scope, data);
  };

  return {
    error: (...data) => write("error", ...data),
    warn: (...data) => write("warn", ...data),
    info: (...data) => write("info", ...data),
    verbose: (...data) => write("verbose", ...data),
    debug: (...data) => write("debug", ...data),
    silly: (...data) => write("silly", ...data),
    log: (...data) => write("log", ...data),
  };
}

export const chatLog = loggerFor("chat");
