# v1.1.12

Patch release for reliable Agent entity links and lean Agent session storage.

> Agent 工具身份协议已由 v1.1.15 取代。`[[ref:Sx]]` source map 只保留为历史 renderer 兼容，不再是当前工具参数契约。

- Render Agent entity links through session-scoped `[[ref:Sx]]` source markers.
- Keep real Understanding / Context / Domain ids in system-maintained source maps, not model text.
- Resolve `[[ref:Sx]]` in the renderer during streaming and history replay.
- Keep unresolved references non-clickable instead of opening blank inspectors.
- Store Agent sessions as canonical turns instead of token-level stream deltas.

See [Agent Entity Link 架构](tech/agent-entity-link-architecture.md).

See [Agent Entity Reference 调研](tech/agent-entity-reference-research.md).

See [Agent Session Canonical Log 技术计划](tech/session-canonical-log-plan.md).
