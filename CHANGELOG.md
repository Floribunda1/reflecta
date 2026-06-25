# Changelog

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
