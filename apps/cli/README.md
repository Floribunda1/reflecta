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
reflecta search --help
```

Help is compact:

```text
Usage: reflecta search <query> [options]
Description: Search understandings and contexts
Returns: SearchOutput — { hits: SearchHit[] }
```

Run an action:

```bash
reflecta search design --limit 10
reflecta graph UNDERSTANDING_ID --depth 1 --include-context
```

Mutating actions require explicit confirmation:

```bash
reflecta understanding create --title Inbox --body "Capture this" --yes
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
2. Reflecta desktop config `contentStorageRoot` plus `reflecta.db`
3. The platform default Reflecta content storage root plus `reflecta.db`

Set `REFLECTA_DB_PATH` when using a development or test database:

```bash
REFLECTA_DB_PATH=/absolute/path/to/reflecta.db reflecta domain list
```

## Understanding Links

Understanding relationships are inferred from wiki links in the understanding body.

In the CLI, write `[[understanding title#target-understanding-id]]` in `understanding create --body` or `understanding update --body`. The CLI stores that syntax directly and derives understanding relationships from it.

## Development

CLI tests create an isolated temporary database automatically.

```bash
bun run --filter '@reflecta/cli' typecheck
bun run --filter '@reflecta/cli' test
bun run --filter '@reflecta/cli' build
```
