# Changelog

## 1.0.2 - 2026-06-22

- Removed the Agent view title bar and adjusted the main window show order after maximizing.
- Added thread title generation from the chat sidebar context menu with streaming support and loading state.
- Added chat sidebar context menu action to copy a thread ID.
- Fixed message replacement so failed persistence cannot delete existing chat content.
- Made composer mentions clickable so Thought and Context references open the inspector.

## 1.0.1 - 2026-06-22

- Fixed Electron dev/prod GUI instances so they can run side by side.
- Improved graph layout for unconnected notes by spreading them across the canvas.
- Widened the graph category filter so selected categories have enough room.

## 1.0.0 - 2026-06-21

- Initial Reflecta desktop release with capture, category, context, contemplate graph, and local storage workflows.
- Added agent chat with configurable model providers and local thread persistence.
- Added local database migrations, CLI access, search, graph, and snapshot commands.
- Added release documentation for tag-based releases.
