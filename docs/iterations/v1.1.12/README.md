# v1.1.12

Patch release for reliable Agent references and lean Agent session storage.

- Add a thread-level Agent Reference Registry for stable clickable Understanding / Context references.
- Migrate new Agent replies from raw `[[type:title#id]]` references to registry handles such as `[[U1]]`.
- Keep unresolved references non-clickable instead of opening blank inspectors.
- Fix legacy typed reference parsing so Context ids are not opened as Understanding ids.
- Store Agent sessions as canonical turns instead of token-level stream deltas.

See [Agent Reference Registry 技术计划](tech/agent-reference-registry-plan.md).

See [Agent Session Canonical Log 技术计划](tech/session-canonical-log-plan.md).
