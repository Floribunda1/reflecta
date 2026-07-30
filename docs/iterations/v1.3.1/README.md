# v1.3.1 — Stable Understanding Switching

This patch release prevents editor failures when switching between Understandings that contain Markdown lists.

- Disables Crepe's unsafe enhanced list-item view.
- Preserves standard Markdown list rendering and editing.
- Adds deterministic unit coverage and verifies the real Electron switching flow.
