# v1.1.15

Patch release plan for Agent tool identity and tool failure legibility.

- Expose stable Reflecta entity ids to Agent tools instead of session-scoped `rf_*` aliases.
- Keep chat refs as display/navigation syntax, not as tool-call input protocol.
- Make approved tool execution states explicit: approval accepted is not the same as tool succeeded.
- Persist and render tool failures so production diagnosis does not require reading raw Pi `toolResult` messages.

See [Agent Tool Identity and Failure State Plan](tech/agent-tool-identity-and-failure-state-plan.md).
