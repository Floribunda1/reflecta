# Reflecta acceptance adapter

## 1. Project summary

Reflecta has a local Electron product (`apps/electron`), CLI (`apps/cli`), shared UI (`packages/ui`) and database services (`packages/server`).

## 2. Environment

Install with `bun install` at the root. Build with `bun run build`. Start development with `bun run dev:gui`; stop only the process started by the run. Inspect running processes before launching. No external database service is required: test data uses isolated SQLite and content directories. Vite configuration is in `apps/electron/vite.config.ts`.

## 3. Auth

Local knowledge management needs no login. `apps/electron/e2e/test-env.ts` creates and seeds an isolated environment and loads optional AI credentials from `.env.test.local`. Never print credential values. AI-dependent cases require `hasE2eAiConfig()`; report skipped cases explicitly.

## 4. Surfaces

Electron: `bun run test:e2e:acceptance` builds and drives the actual Electron executable through Playwright. `launchApp` in `e2e/acceptance/spec/agent/agent-e2e.ts` provides isolation and logs; `app.close()` tears it down. CLI: `bun run --cwd apps/cli build`, then `node apps/cli/dist/index.mjs --help`. Root installation covers both.

## 5. Project probes & quick navigation

Use the existing E2E helpers. `openCapturePage`, `openUnderstanding`, `openAgentPage` and navigation test IDs exercise real entry points. Ready state is `capture-page` or `agent-page`. Screenshots must capture the visible Playwright page viewport, not the full document. The environment helper provides each test's config, content, database and user-data paths.

## 6. Known constraints

Native dependencies must match the Electron ABI; the app's postinstall runs `electron-builder install-app-deps`. Build before launching E2E. Default Playwright projects include benchmarks; select acceptance, regression and integration explicitly for functional verification. Test cleanup removes only its generated temporary directories. AI credentials and model availability can limit live-provider coverage.
