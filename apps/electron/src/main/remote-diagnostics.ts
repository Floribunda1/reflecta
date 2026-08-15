import type { DiagnosticEvent, DiagnosticEventInput, DiagnosticLevel } from "./diagnostic-log";
import { redactDiagnosticEvent } from "./diagnostic-log";
import { onDiagnosticEvent } from "./logger";

// Remote telemetry seam: forwards diagnostic events to an endpoint as JSON
// POSTs. Off by default — enable only behind an explicit opt-in (runtime arg
// `--reflecta-telemetry-url`), never silently. Redaction happens at this
// boundary so no sink ever carries user content.

const LEVEL_RANK: Record<DiagnosticLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export type RemoteDiagnosticsOptions = {
  level?: DiagnosticLevel;
  headers?: Record<string, string>;
  fetchFn?: (input: string, init: RequestInit) => Promise<unknown>;
};

export function forwardDiagnosticEvents(
  url: string,
  options: RemoteDiagnosticsOptions = {},
): () => void {
  const minRank = LEVEL_RANK[options.level ?? "warn"];
  const headers = { "content-type": "application/json", ...options.headers };
  const fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));

  return onDiagnosticEvent((event: DiagnosticEventInput) => {
    if (LEVEL_RANK[event.level] < minRank) return;
    const safe = redactDiagnosticEvent(event as DiagnosticEvent);
    void fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(safe),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {
      // Remote forwarding must never affect app behavior.
    });
  });
}
