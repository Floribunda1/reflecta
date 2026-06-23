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
node apps/cli/dist/index.mjs search understandings design
node apps/cli/dist/index.mjs understanding create --title Inbox --yes
```

All CLI results are JSON on stdout. Mutating actions require the `--yes` flag.

Set `REFLECTA_DB_PATH=/absolute/path/to/reflecta.db` to point the CLI at a specific Reflecta database.

Electron uses a content storage directory that contains `reflecta.db` and `assets/`. For development
or test runs, set `REFLECTA_CONTENT_STORAGE_ROOT=/absolute/path/to/content-root`.

## Development

```bash
bun run --filter '@reflecta/cli' typecheck
bun run --filter '@reflecta/cli' test
bun run --filter '@reflecta/cli' build
```
