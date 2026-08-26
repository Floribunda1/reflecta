# v1.5.1

Observability patch release: error monitoring infrastructure, native crash
collection, and renderer error capture so production-only failures become
diagnosable.

- Error aggregation (`ErrorAggregator`): repeated errors are counted by a
  stable fingerprint (`scope|event|ipc.channel|source|error.name|error.message`)
  and emitted as `error.aggregate` events once the count reaches 3, flushed on
  a 60s timer and before-quit, day-partitioned. Original error lines are never
  suppressed.
- Native crash collection: `crashReporter` (Crashpad) enabled in packaged
  builds with `uploadToServer: false`, minidumps stored under
  `<appConfigDir>/crash-dumps`.
- Telemetry seam: `onDiagnosticEvent()` observer on the diagnostic outlet plus
  `forwardDiagnosticEvents()` (redacted JSON POST), off by default, enabled
  only via `--reflecta-telemetry-url`.
- Feed-driven render errors: the preload session feed port handler now wraps
  `receive()` and reports errors as `source=feed.receive` with
  `feed.kind` / `feed.sessionId` / `feed.revision`; `createRoot` gained
  `onUncaughtError` / `onCaughtError` so render-phase errors carry
  componentStack. This makes "Maximum update depth exceeded" (#185)
  diagnosable instead of a minified one-frame stack.
- Toast policy: removed the global window-error toast boundary — system
  crashes stay in the diagnostic log, toasts are reserved for
  business-operation failures.
- Logger: `DiagnosticLogger` with `withPrefix()` (Mattermost pattern),
  replacing `createScopedLog` with no call-site changes.
- Reference guide: `docs/references/technical/observability.md` documents the
  write paths, error capture layers, aggregation, and the telemetry seam.

Deliberately not done: per-error-type noise classification (open-ended patch
surface), and the #185 root-cause component fix (pending a contextual
reproduction; the capture work in this release makes that possible).
