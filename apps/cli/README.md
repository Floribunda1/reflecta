# Reflecta CLI

`@reflecta/cli` exposes Reflecta's local knowledge base through a token-lean agent CLI.

## Usage

List actions:

```bash
reflecta list-actions
```

`!` marks mutating actions.

Show input and output help for one action:

```bash
reflecta help search_thoughts
```

Help is compact:

```text
name search_thoughts
mutates 0
req query
opt limit,offset
json {"query":"design","limit":20,"offset":0}
out ThoughtSummaryDTO[]
```

Run an action:

```bash
reflecta search_thoughts --json '{"query":"design","limit":10}'
```

Mutating actions require explicit confirmation:

```bash
reflecta create_thought --json '{"type":"idea","title":"Inbox","body":"Capture this"}' --confirm
```

Action results are written directly as JSON on stdout, without wrappers:

```json
{}
```

Actions with no result write no stdout output; success is exit code `0`.

Failures are written to stderr and exit with code `1`:

```text
INVALID_ARGUMENTS: Action arguments are invalid.
```

## Database Path

The CLI resolves the local Reflecta database in this order:

1. `REFLECTA_DB_PATH`
2. Reflecta desktop config `storagePath` plus `reflecta.db`
3. The platform default Reflecta application data directory

Set `REFLECTA_DB_PATH` when using a development or test database:

```bash
REFLECTA_DB_PATH=/absolute/path/to/reflecta.db reflecta list_categories --json '{}'
```

## Development

```bash
bun run --filter '@reflecta/cli' typecheck
bun run --filter '@reflecta/cli' test
bun run --filter '@reflecta/cli' build
```
