# v1.2.4 — Agent Web Search

This patch release adds direct web search and source reading to the Reflecta Agent.

- Integrates Pi Web Access with Exa and automatic summaries, without opening a browser confirmation page.
- Adds `web_search`, `fetch_content`, and `get_search_content` with concise conversation activity states.
- Removes the legacy `web_fetch` implementation and keeps the system prompt independent of specific tool contracts.
- Updates the Pi Agent runtime to 0.81.1 and verifies extension loading in packaged Electron builds.
