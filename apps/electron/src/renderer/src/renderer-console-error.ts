const DIAGNOSTIC_RENDERER_ERROR_CHANNEL = "diagnostic:renderer-error";
const originalConsoleError = console.error.bind(console);

console.error = (...args: unknown[]) => {
  originalConsoleError(...args);

  const payload = {
    source: "console.error",
    args,
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
