# Changelog

## 1.3.13 - 2026-08-03

- Stabilized Agent streaming scroll behavior so replies stay pinned only at the bottom, preserve the user's reading position after scrolling away, resume following after returning to the bottom, and no longer trigger ResizeObserver errors.

## 1.3.12 - 2026-08-02

- Kept Agent conversations at the user's reading position when a streaming reply grows after scrolling up and then slightly down.

## 1.3.11 - 2026-08-02

- Unified persisted and live Agent events behind a revisioned session projection, preventing duplicate replies after switching conversations or refocusing the app window.
- Added a distraction-free Understanding focus mode and aligned Understanding and Context inspector actions for a more consistent editing workflow.
- Restored subtle item counts in Capture list and Knowledge Wander headers.

## 1.3.10 - 2026-08-02

- Hydrated Understanding update previews while tool arguments stream so existing content is available before confirmation.
- Applied Proposal lifecycle events immediately instead of waiting for an animation frame, preventing cards from remaining stuck in the generating state until the conversation is reopened.
- Matched Understanding and Domain title prefixes in mention search while preserving ranked retrieval for broader queries.

## 1.3.9 - 2026-08-01

- Moved Understanding recognition, cognitive-fidelity, and writing guidance into a dedicated built-in Agent skill while keeping Context in its own focused skill.
- Preserved Context as the concrete, detailed source and scene around an Understanding without adding new abstraction or summarization rules.
- Fixed remaining Agent conversation scroll jumps during streaming and after edited-message refetches.

## 1.3.8 - 2026-08-01

- Preserved Agent conversation scroll position while responses stream and remain interactive.
- Kept streaming reasoning details expandable and made grouped reasoning blocks independently toggleable.
- Stabilized Agent conversation branching and Contextual Agent panel resizing across the Electron workflow.

## 1.3.7 - 2026-07-31

- Virtualized long Agent conversations so loading, scrolling, search, menus, and distant message jumps remain responsive with large histories.
- Refined jump navigation into a quieter top-right rail with clearer progress, stronger contrast, and less idle visual noise.
- Relaxed Agent thread sidebar spacing and widened its default layout for easier scanning.

## 1.3.6 - 2026-07-31

- Clarified proposal lifecycle states and kept rejection reasons visible in proposal details, including when the reason is long.
- Improved Agent chat in narrow windows by keeping jump navigation accessible, aligning its responsive breakpoint, and preventing stale hover state.
- Simplified inline editing actions by removing redundant guidance and shortening the action label.

## 1.3.5 - 2026-07-31

- Refined Agent activity receipts so single and grouped reasoning, tools, and proposals remain visually distinct from the final response while preserving inline disclosure and execution status.
- Unified Reflecta entity references around stable typed markers, with Understanding bodies limited to `[[u:<id>]]`, consistent Agent rendering, and automatic migration of legacy Understanding links.
- Simplified completed proposal receipts, preserved approval and execution outcomes, and removed redundant result metadata from the visible conversation.

## 1.3.4 - 2026-07-31

- Reduced the packaged Electron footprint with maximum compression, focused locale/runtime inclusion, and stricter exclusions for development-only files and unused native payloads.
- Replaced the experimental Markstream React chat renderer with Streamdown so long Markdown responses remain visible while preserving streaming, search highlighting, entity links, code, math, and diagram controls.
- Refined Milkdown and Streamdown Mermaid rendering with restrained VS Code-inspired light and dark themes, solid backgrounds, improved contrast, and broader diagram coverage.

## 1.3.3 - 2026-07-30

- Standardized the macOS update menu and fallback messages in English.
- Stabilized streaming Agent responses by keeping Markstream's live rendering window enabled and attaching the working state only to the active run.
- Reworked JumpNav around complete conversation turns so long Agent responses retain the correct current-turn position without flickering or falling back to an empty index.

## 1.3.2 - 2026-07-30

- Replaced the split Electron update prompts with Sparkle's standard macOS flow for silent automatic checks, foreground manual results, release notes, skip/install choices, download progress, installation, and relaunch.

## 1.3.1 - 2026-07-30

- Fixed Understanding switching failures by disabling Crepe's unsafe enhanced list-item view while preserving standard Markdown list editing.

## 1.3.0 - 2026-07-30

- Introduced the shared `@reflecta/ui` workspace and Storybook acceptance surface for UI foundations, Markdown editing, Agent chat, Capture, and Knowledge Wander components.
- Reworked the Agent conversation experience with continuous streaming feedback, grouped reasoning and tool activity, richer proposal decisions, improved search and jump navigation, and Markstream-based Markdown rendering.
- Improved Agent session recovery and continuity with cached summaries, durable live events, stable approval ownership, and clearer context-compaction states.
- Refined Capture composition, Domain organization, Understanding editing, Context management, and knowledge graph interactions around reusable product-level UI modules.
- Added Sparkle-powered macOS update checks, signed incremental updates, changelog display, automatic relaunch, and tag-driven GitHub Releases without requiring an Apple Developer account.

## 1.2.4 - 2026-07-22

- Added direct Agent web search through Pi Web Access, fixed to Exa with automatic summaries and no browser confirmation page.
- Added source reading and stored search-content retrieval with concise tool activity states in Agent conversations.
- Removed the legacy `web_fetch` implementation and kept external-information guidance tool-agnostic in the system prompt.
- Updated the Pi Agent runtime packages to 0.81.1 and verified the extension in development and packaged Electron builds.

## 1.2.3 - 2026-07-21

- Added an MIT license and a public-facing README with the product value proposition, privacy notes, source setup, and real application screenshots using synthetic data.
- Moved production-derived Retrieval quality evaluation code and datasets into an ignored private workspace while keeping public tests independent of those assets.
- Removed the obsolete Skills package and anonymized local machine paths across tracked tests and documentation.
- Audited and sanitized the repository history for public source distribution.

## 1.2.2 - 2026-07-21

- Added automatic and manual Agent context compaction with visible progress and durable compaction history.
- Projected the active branch's entity catalog into model context without persisting repeated catalog payloads in conversation history.
- Added the complete conversation action menu to thread-list context menus.
- Fixed Agent resizer layout gaps and kept newly forked conversations at the top of the thread list after refresh or restart.

## 1.2.1 - 2026-07-20

- Moved Capture and Agent navigation into the sidebar footer as direct contextual actions with consistent hover styling.
- Added animated, collapsible page sidebars with distinct expand and collapse controls that stay aligned with the macOS window controls.
- Made the Capture Understanding list and Agent thread list horizontally resizable while preserving collapsed layouts.
- Preserved Unicode filenames in Agent Bash output.

## 1.2.0 - 2026-07-20

- Replaced the standalone Contemplate module with Knowledge Wander inside Capture, leaving Capture and Agent as the two top-level product surfaces.
- Rebuilt Knowledge Wander as an Obsidian-style force-directed graph of Understandings and explicit Connections, including isolated nodes, native pan/zoom/drag, smooth neighborhood focus, stable selection, and direct access to Understanding details and Context.
- Moved the Knowledge Wander entry into the Capture toolbar and aligned graph controls, Markdown previews, metadata, and interaction styling with the current design system.
- Made CLI release artifacts portable by packaging migrations and externalizing native runtime dependencies, while preventing CLI tests from resolving user profile databases.

## 1.1.22 - 2026-07-19

- Switched Agent citations to direct stable entity markers for Understandings, Contexts, and Domains, rendered through current entity metadata.
- Removed runtime reliance on per-message `citationSources` and migrated production/test Agent sessions to the direct marker format.
- Added DeepSeek v4-Flash citation reliability coverage for long conversations with many interleaved citations.

## 1.1.21 - 2026-07-18

- Replaced the Agent's custom local file and shell tools with Pi's built-in `read`, `bash`, `edit`, and `write` tools, configured through Pi's official resource loader.
- Added confirmation for dangerous Bash commands while ordinary commands continue without interruption, with durable approval state and real application E2E coverage.
- Clarified rejected Bash feedback as “command not executed” and kept knowledge-write approval wording scoped to knowledge proposals.
- Required newly created Context entries to preserve concrete experience details instead of collapsing into generic summaries.

## 1.1.20 - 2026-07-18

- Rebuilt knowledge retrieval around parallel ICU/BM25 and dense search with RRF fusion, including production-session quality coverage.
- Replaced dirty markers, polling, and read-time compensation with asynchronous post-save indexing, incremental LanceDB updates, startup reconciliation, and best-effort index maintenance.
- Moved local embedding work into a short-lived Electron utility process so the model is released when the queue becomes idle.
- Sourced AI provider model catalogs from pi-ai and added provider model-selection coverage.
- Preserved mutation titles when Agent write results are turned into citation sources.

## 1.1.19 - 2026-07-09

- Kept retrieval dirty-index sync asynchronous while preserving incremental updates for ready indexes.
- Added `understandingId` support to Context update flows so CLI and Agent tools can move Context between Understandings.
- Clarified Agent instructions for when to create Understanding knowledge versus supporting Context.

## 1.1.18 - 2026-07-08

- Added contextual Agent dock navigation to jump from a page-level dock into the full Agent thread.
- Improved chat composer layout so the toolbar stays available while long drafts scroll inside the editor area.
- Streamed Agent approval proposal previews while tools are still being generated, then collapsed completed proposal cards into compact receipts.
- Let Reflecta fill Understanding update `before` state from the current record instead of asking the Agent to supply it.
- Documented wiki-link Markdown body guidance for Agent write tools.

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
