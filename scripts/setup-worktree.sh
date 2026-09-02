#!/usr/bin/env bash
# Idempotent bootstrap for a git worktree of this bun monorepo.
#
# A worktree is a fresh checkout: node_modules (5.7GB) and the gitignored
# .env.*.local files never carry over. This script provisions both from the
# main checkout and fail-fast if it can't.
#
# Safe to re-run any number of times.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Locate the main checkout (parent of the shared git dir). In the main
# checkout this resolves to ROOT itself, in a linked worktree to the primary.
PRIMARY="$(cd "$(dirname "$(git rev-parse --git-common-dir)")" && pwd)"

# 1. Share the primary checkout's dependency tree. Same repo => identical
#    lockfile, so the symlinks are exact and native/electron artifacts are
#    reused. bun installs per-workspace node_modules (apps/*, packages/*) full
#    of symlinks into the .bun store, so every one must be linked.
if [ "$PRIMARY" != "$ROOT" ]; then
  for nm in "$PRIMARY/node_modules" "$PRIMARY"/apps/*/node_modules "$PRIMARY"/packages/*/node_modules; do
    [ -d "$nm" ] || continue
    rel="${nm#$PRIMARY/}"
    [ -e "$rel" ] || { ln -s "$PRIMARY/$rel" "$rel" && echo "[setup] symlinked $rel"; }
  done
fi

# 2. Provision the local env files from the primary checkout (never tracked).
for f in .env.development.local .env.production.local .env.test.local; do
  if [ -e "$PRIMARY/$f" ] && [ ! -e "$f" ]; then
    cp "$PRIMARY/$f" "$f"
    echo "[setup] copied $f"
  fi
done

# 3. Fail fast with a clear message instead of a cryptic runtime error.
if [ ! -d node_modules ]; then
  echo "ERROR: node_modules missing. Bootstrap from the main checkout first (bun install), then re-run." >&2
  exit 1
fi
if [ ! -e .env.development.local ] && [ ! -e .env.test.local ]; then
  echo "WARNING: no .env.*.local found. Copy from the main checkout or create one before dev/test." >&2
fi

# 4. Ensure the electron binary is present (idempotent). The zip is cached in
#    ~/Library/Caches/electron, so this is fast. Skipped when node_modules was
#    symlinked, since the shared primary already has it.
ELECTRON_DIR="$(find node_modules/.bun -maxdepth 3 -path '*electron@*/node_modules/electron' -type d 2>/dev/null | head -1)"
if [ -n "$ELECTRON_DIR" ] && [ ! -d "$ELECTRON_DIR/dist" ]; then
  echo "[setup] downloading electron binary..."
  (cd "$ELECTRON_DIR" && node install.js)
fi

echo "[setup] worktree ready: $ROOT"
