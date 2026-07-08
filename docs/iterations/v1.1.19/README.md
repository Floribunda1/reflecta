# v1.1.19

Patch release for retrieval sync reliability and Context ownership updates.

- Retrieval dirty-index sync remains asynchronous and updates ready indexes incrementally.
- `context update` accepts `--understanding-id` to move a Context to another Understanding.
- The Agent `context_update` approval tool accepts `understandingId` and validates stable entity ids.
- Context moves mark both old and new Understanding retrieval indexes dirty.
- Agent prompt guidance now distinguishes durable Understanding knowledge from supporting Context.
