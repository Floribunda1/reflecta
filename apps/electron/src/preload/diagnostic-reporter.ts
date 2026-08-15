import { ipcRenderer } from "electron";

export const DIAGNOSTIC_RENDERER_ERROR_CHANNEL = "diagnostic:renderer-error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function rendererErrorPayload(
  source: string,
  error: unknown,
  attrs: Record<string, unknown> = {},
): Record<string, unknown> {
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
  return payload;
}

export function sendRendererError(payload: Record<string, unknown>): void {
  try {
    ipcRenderer.send(DIAGNOSTIC_RENDERER_ERROR_CHANNEL, payload);
  } catch {
    // Renderer fallback logging must never throw inside the original error path.
  }
}
