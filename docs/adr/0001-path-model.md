# ADR 0001: Separate App Config Dir, Content Storage Root, and Database Path

## Status

Accepted

## Context

Reflecta previously used broad names such as `storagePath` and generic storage wording for different path
concepts. Electron needs a directory for user content and assets, while CLI and Drizzle need a
specific SQLite file path. Mixing those concepts made development, testing, and documentation
ambiguous.

## Decision

Reflecta uses three path concepts:

- App Config Dir: the directory containing `reflecta-config.json`.
- Content Storage Root: the directory containing `reflecta.db` and `assets/`.
- Database Path: the concrete SQLite file path.

Electron resolves Content Storage Root and derives the Database Path from it. CLI and Drizzle keep
using `REFLECTA_DB_PATH` because they operate on a database file.

Electron may use `REFLECTA_CONTENT_STORAGE_ROOT` as a runtime override. CLI and Drizzle do not read
that variable.

## Consequences

- The settings UI exposes only the data directory.
- Existing `storagePath` config is intentionally not migrated.
- Tests can isolate data by choosing a Content Storage Root or Database Path appropriate to the
  process under test.
