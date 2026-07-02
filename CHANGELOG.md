# Changelog

## 1.1.17 - 2026-07-02

- Replaced Agent inline references with per-answer numbered citation sources and plain text streaming.
- Rendered valid citation markers as Reflecta entity title links while keeping unknown and code-formatted markers as plain text.
- Migrated production Agent session inline references to `text + citationSources` and removed runtime migration logic and obsolete structured-reference docs.

## 1.1.15 - 2026-06-30

- Switched Agent tools to stable Reflecta entity ids and removed legacy `ref` tool inputs.
- Persisted approved tool execution states so failed confirmed tools render as failed with the error reason after replay.
- Migrated production and test Agent sessions to canonical execution events and removed runtime legacy session/ref compatibility.

## 1.1.13 - 2026-06-28

- Fixed the Agent context meter to use actual runtime usage instead of renderer-side estimation.
- Restored active Agent stream recovery after reloads.
- Fixed chat composer Enter handling so sending messages and selecting context mentions do not insert stray newlines.

## 1.1.12 - 2026-06-26

- Rendered Agent entity links through session-scoped source markers so model text no longer carries raw entity ids.
- Resolved Agent entity references during streaming and history replay, leaving unresolved references non-clickable.
- Stored Agent sessions as canonical turns instead of token-level stream deltas.

## 1.1.11 - 2026-06-25

- Fixed chat title generation so generic fallback titles no longer overwrite non-empty conversations.
- Increased title generation output budget and disabled explicit reasoning for the title pass to avoid empty length-cutoff responses.
- Added title generation diagnostics for model output and persistence decisions.

## 1.1.10 - 2026-06-25

- Added AI title generation through the configured title model path.
- Added toast feedback for chat and settings actions.
- Restored Domain Tree drag sorting with sibling-only reordering and expanded subtree drag coverage.
- Fixed Domain Tree drag previews so expanded items move as a block without stretching the visible row.

## 1.1.9 - 2026-06-25

- Moved app-owned retrieval index and diagnostic logs into app config storage so custom content roots keep only user-owned DB, sessions, and assets.

## 1.1.8 - 2026-06-25

- Removed Electron safeStorage config encryption so packaged app launches no longer prompt for macOS Keychain access to Chromium Safe Storage.

## 1.1.7 - 2026-06-25

- Added an inline editable Agent thread title bar with consolidated thread actions.
- Added Markdown export for user prompts and Agent replies.
- Moved Agent fork to assistant replies so new branches start from the selected response.
- Aligned the Agent thread header with the detail inspector header.

## 1.1.6 - 2026-06-25

- Fixed Agent composer paste behavior so Markdown copied from rendered content stays editable as plain text.
- Improved Agent chat jump navigation in the collapsed state.
- Fixed proposal references so they render as readable labels with domain paths.

## 1.1.5 - 2026-06-25

- Show an in-chat pending Agent response state before the first assistant content arrives, so the main conversation no longer appears idle while the model is starting.

## 1.1.4 - 2026-06-25

- Improved Agent tool activity rendering for approval tools, keeping each tool call separate and showing approved Bash execution results.
- Added inline folding for long Bash stdout and stderr so large outputs stay scannable while remaining expandable in place.
- Removed the temporary Agent tool demo route from the app shell.

## 1.1.3 - 2026-06-25

- Improved Agent tool activity details so expanded tool output shows user-facing evidence, summaries, and readable empty/error states instead of raw execution metadata.

## 1.1.2 - 2026-06-25

- Fixed packaged Electron startup by bundling the LanceDB `apache-arrow` dependency.
- Added runtime environment isolation so release Electron and release CLI share production data while source, test, and script entrypoints default away from production.
- Hardened CLI, seed, and migration paths against accidental production data pollution.

## 1.1.1 - 2026-06-24

- Fixed CLI semantic search so it loads the configured retrieval embedding provider and index path from the desktop config.

## 1.1.0 - 2026-06-24

- Renamed the core product language from Categories and Thoughts to Domains and Understandings across the app, CLI, docs, and migration path.
- Added local semantic retrieval with domain anchors, local embedding configuration, dirty-index rebuilds, indexing status, and a retrieval quality benchmark runner.
- Added the Pi-backed agent runtime with detailed tool activity, knowledge retrieval, web fetch, attachments, and improved tool summaries.
- Added contextual agent docks for Capture and Contemplate, plus chat jump shortcuts and contextual agent history controls.
- Added diagnostic logging boundaries with daily log rotation.
- Fixed retrieval quality, CJK lexical matching, exact keyword behavior, native LanceDB packaging, and unsent draft visibility in the thread list.

## 1.0.3 - 2026-06-22

- Fixed chat composer mention search so non-empty queries search all matching Understandings instead of filtering only the recent list.

## 1.0.2 - 2026-06-22

- Removed the Agent view title bar and adjusted the main window show order after maximizing.
- Added thread title generation from the chat sidebar context menu with streaming support and loading state.
- Added chat sidebar context menu action to copy a thread ID.
- Fixed message replacement so failed persistence cannot delete existing chat content.
- Made composer mentions clickable so Understanding and Context references open the inspector.

## 1.0.1 - 2026-06-22

- Fixed Electron dev/prod GUI instances so they can run side by side.
- Improved graph layout for unconnected Understandings by spreading them across the canvas.
- Widened the graph domain filter so selected domains have enough room.

## 1.0.0 - 2026-06-21

- Initial Reflecta desktop release with capture, domain, context, contemplate graph, and local storage workflows.
- Added agent chat with configurable model providers and local thread persistence.
- Added local database migrations, CLI access, search, graph, and snapshot commands.
- Added release documentation for tag-based releases.
