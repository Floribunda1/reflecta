# v1.3.3 — Stable Agent Conversation Flow

This patch release stabilizes long, streaming Agent conversations and their navigation.

- Keeps Markstream's live rendering window enabled during streaming.
- Shows the working state only on the Agent turn owned by the active run.
- Treats each user request and its Agent response as one navigable turn.
- Keeps JumpNav on the correct turn throughout long responses.
- Standardizes the macOS update menu and fallback messages in English.
