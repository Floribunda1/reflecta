# Reflecta CLI

`@reflecta/cli` exposes Reflecta's local knowledge base through a script-friendly JSON CLI.

## Usage

List actions:

```bash
reflecta list-actions
```

Show input and output help for one action:

```bash
reflecta help search_thoughts
```

Run an action:

```bash
reflecta search_thoughts --json '{"query":"design","limit":10}'
```

Mutating actions require explicit confirmation:

```bash
reflecta create_thought --json '{"type":"idea","title":"Inbox","body":"Capture this"}' --confirm
```

All command results are JSON on stdout:

```json
{ "ok": true, "data": {} }
```

Failures use the same envelope and exit with code `1`:

```json
{
  "ok": false,
  "error": { "code": "INVALID_ARGUMENTS", "message": "Action arguments are invalid." }
}
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
