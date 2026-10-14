# v2.0.8

## CLI data compatibility

CLI verification now compares the database version with the highest registered migration required by the application, rather than the application version itself. Application-only patch releases therefore accept databases that already completed the latest migration. Failed connections are closed instead of cached, and source connections cannot bypass release verification.

## Interface and runtime maintenance

Unified the default interface and Markdown fonts with Geist. Upgraded workspace dependencies and migrated Electron IPC to the stable Effect 4 RPC APIs.

## Release validation

End-to-end tests are omitted for this release at the maintainer's explicit request. Lint, formatting, type checks, and unit tests remain release gates. Existing formatting mismatches introduced by the dependency upgrade are normalized without behavioral changes.
