# reflecta-mono

To install dependencies:

```bash
bun install
```

## CLI

Reflecta exposes a script-friendly JSON CLI through `@reflecta/cli`.

```bash
bun run --filter '@reflecta/cli' build
node apps/cli/dist/index.mjs list-actions
node apps/cli/dist/index.mjs search_thoughts --json '{"query":"design"}'
node apps/cli/dist/index.mjs create_thought --json '{"type":"idea","title":"Inbox"}' --confirm
```

All CLI results are JSON on stdout. Mutating actions require `confirm: true` in the JSON payload or the `--confirm` flag.

Set `REFLECTA_DB_PATH=/absolute/path/to/reflecta.db` to point the CLI at a specific Reflecta database.

## Development

```bash
bun run --filter '@reflecta/cli' typecheck
bun run --filter '@reflecta/cli' test
bun run --filter '@reflecta/cli' build
```
