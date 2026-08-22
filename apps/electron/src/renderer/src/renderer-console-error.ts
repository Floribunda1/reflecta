const DIAGNOSTIC_RENDERER_ERROR_CHANNEL = "diagnostic:renderer-error";
const originalConsoleError = console.error.bind(console);

console.error = (...args: unknown[]) => {
  originalConsoleError(...args);

  const payload = {
    source: "console.error",
    args,
    // 完整保留每个参数（React 的组件栈 / 重复 key 的父组件在 args[1+]），
    // 供 diagnostic JSONL 定位告警来源；message 只格式化第一个参数会丢上下文。
    detail: args.map((arg) => {
      try {
        return typeof arg === "string" ? arg : String(arg);
      } catch {
        return "<unstringifiable>";
      }
    }),
    stack: new Error("console.error").stack,
    href: window.location.href,
    userAgent: navigator.userAgent,
  };
  try {
    window.ipcRenderer?.send(DIAGNOSTIC_RENDERER_ERROR_CHANNEL, payload);
  } catch {
    try {
      window.ipcRenderer?.send(DIAGNOSTIC_RENDERER_ERROR_CHANNEL, {
        ...payload,
        args: args.map(String),
      });
    } catch {
      // Console logging must never become the error path.
    }
  }
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.error = originalConsoleError;
  });
}
