const DIAGNOSTIC_RENDERER_ERROR_CHANNEL = "diagnostic:renderer-error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Report a renderer error to the main process diagnostic log (best-effort). */
export function reportRendererError(
  source: string,
  error: unknown,
  attrs: Record<string, unknown> = {},
): void {
  try {
    const payload: Record<string, unknown> = {
      source,
      href: window.location.href,
      userAgent: navigator.userAgent,
      ...attrs,
    };
    if (error instanceof Error) {
      payload.message = error.message;
      payload.stack = error.stack;
    } else if (isRecord(error)) {
      payload.message = typeof error.message === "string" ? error.message : JSON.stringify(error);
      payload.stack = typeof error.stack === "string" ? error.stack : undefined;
    } else {
      payload.message = String(error);
    }
    window.ipcRenderer?.send(DIAGNOSTIC_RENDERER_ERROR_CHANNEL, payload);
  } catch {
    // Error reporting must never throw while the app is recovering.
  }
}
