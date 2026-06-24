# v1.1.2 Runtime Environment Isolation 计划

> 日期：2026-06-25
>
> 状态：Draft
>
> 目标：重做 Reflecta 的 dev / test / prod 环境边界，把“运行形态”“数据目标”“迁移权限”拆开，永久杜绝源码态、测试态或脚本态误读/误写生产数据库。

## 1. 结论

这次问题不是 `.env.production.local` 单点事故，也不是某个 CLI 测试缺 guard。

真正的问题是当前系统把三种不同概念压进了一个 `REFLECTA_PROFILE=dev|prod`：

```txt
运行形态：source / test / packaged
数据目标：dev DB / test DB / prod user DB
迁移权限：是否允许自动升级数据库 schema
```

这导致任意源码态 Bun 进程只要拿到 `REFLECTA_PROFILE=prod`，就可能走到：

```txt
prod profile
  -> ~/Library/Application Support/reflecta/reflecta-config.json
  -> contentStorageRoot
  -> prod reflecta.db
  -> migration / write / seed / test fixture
```

最终架构应该改成：

```txt
Production data is not a profile.
Production data is a capability granted only to explicit production entrypoints.
```

也就是：

- Electron packaged app 是唯一默认生产数据入口。
- CLI 是显式数据库文件工具，不能隐式发现生产库。
- Tests / seed / dev-db scripts 只能操作 test/dev 数据。
- Migration 权限不再由 `profile === "prod"` 推导，而由 runtime policy 明确授予。

## 2. 设计原则

### 2.1 `NODE_ENV` 不能决定用户数据

Bun 会自动加载 `.env*` 文件，并根据 `NODE_ENV` 加载 production / development / test 变体。

所以 `NODE_ENV=production` 只能影响构建工具或框架模式，不能影响 Reflecta 数据库选择。

### 2.2 删除共享 `profile`

`profile` 这个词已经承载太多含义。最终代码里不应该继续用：

```txt
REFLECTA_PROFILE=dev|prod
```

替代为显式的 runtime model：

```ts
type RuntimeKind = "electron-packaged" | "electron-dev" | "cli" | "test" | "script";
type DataEnvironment = "prod" | "dev" | "test";
type MigrationPolicy = "auto" | "disabled" | "dev-only";
```

### 2.3 路径解析必须成为深模块

现在路径规则散在：

- `apps/electron/src/main/config.ts`
- `apps/electron/src/main/db/index.ts`
- `apps/cli/src/profile.ts`
- `apps/cli/src/db.ts`
- `apps/cli/scripts/dev-db.ts`
- `drizzle.config.ts`

最终应该收敛为一个深模块：

```txt
runtime input
  -> resolveReflectaRuntime()
  -> resolved appConfigDir / contentStorageRoot / dbPath / migrationPolicy
```

调用方只能消费 resolved result，不能自己拼 `reflecta`、`reflecta-dev`、`reflecta.db`。

## 3. 目标架构

### 3.1 Runtime Resolver

新增共享模块：

```txt
packages/server/src/runtime/
  resolve.ts
  types.ts
```

接口：

```ts
type ResolveRuntimeInput =
  | {
      kind: "electron";
      isPackaged: boolean;
      appDataDir: string;
      userDataDir: string;
      env: NodeJS.ProcessEnv;
    }
  | {
      kind: "cli";
      dbPath?: string;
      appConfigDir?: string;
      env: NodeJS.ProcessEnv;
    }
  | {
      kind: "script";
      target: "dev" | "test";
      env: NodeJS.ProcessEnv;
    };

type ResolvedRuntime = {
  runtimeKind: RuntimeKind;
  dataEnvironment: DataEnvironment;
  appConfigDir?: string;
  contentStorageRoot?: string;
  dbPath: string;
  retrievalIndexPath?: string;
  migrationPolicy: MigrationPolicy;
};
```

规则：

```txt
electron + isPackaged=true
  -> dataEnvironment=prod
  -> appConfigDir=userDataDir
  -> contentStorageRoot from app config or userDataDir
  -> migrationPolicy=auto

electron + isPackaged=false
  -> dataEnvironment=dev
  -> appConfigDir=<appData>/reflecta-dev
  -> contentStorageRoot from env override or dev app config or <appData>/reflecta-dev
  -> migrationPolicy=disabled

cli
  -> requires explicit dbPath
  -> never reads production desktop config to discover dbPath
  -> migrationPolicy=disabled by default

script target=dev
  -> dev db path only
  -> migrationPolicy=dev-only

script target=test
  -> temp db path only
  -> migrationPolicy=dev-only
```

### 3.2 CLI Becomes Explicit DB Tool

CLI should stop doing this:

```txt
no REFLECTA_DB_PATH
  -> read desktop reflecta-config.json
  -> derive prod DB
```

New rule:

```txt
reflecta CLI requires --db or REFLECTA_DB_PATH for commands that touch the database.
```

Recommended command shape:

```bash
reflecta --db /absolute/path/to/reflecta.db understanding list
```

`REFLECTA_APP_CONFIG_DIR` may still be used to load retrieval / AI config, but it must not decide which DB is opened.

### 3.3 Electron Owns User Content Storage

Electron remains the owner of:

- App Config Dir
- Content Storage Root
- assets directory
- production automatic migration

Packaged Electron can default to prod because it is the product runtime.

Electron dev cannot switch to prod by env. If a developer needs to inspect prod data, that must be a deliberate separate tool flow with explicit DB path, not `bun run dev`.

### 3.4 Migration Policy Is Separate

Replace:

```ts
runMigrations: getReflectaProfile() === "prod";
```

With:

```ts
runMigrations: runtime.migrationPolicy === "auto";
```

Allowed policies:

```txt
auto
  Only packaged Electron production runtime.

dev-only
  Dev/test scripts that create disposable databases.

disabled
  CLI, tests after setup, Electron dev.
```

This prevents a source CLI command from upgrading a user DB just because it read a prod env value.

### 3.5 Database Environment Marker

Add metadata table:

```sql
CREATE TABLE IF NOT EXISTS _reflecta_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Required key:

```txt
data_environment = prod | dev | test
```

Runtime checks:

```txt
electron-packaged can open prod.
electron-dev can open dev.
cli can open any explicit DB, but writes require explicit confirmation if marker=prod.
test/script cannot open prod.
seed cannot truncate prod.
```

The marker matters because path names are not a security boundary. A production DB can be copied or renamed; the DB itself must carry its data environment.

### 3.6 Seed Script Must Be Non-Destructive By Default

Current seed behavior truncates an existing DB before inserting fixtures. That is incompatible with safe environment boundaries.

New rules:

```txt
seed-test-data creates or seeds only disposable databases.
seed-test-data refuses an existing DB unless --reset-disposable is passed.
--reset-disposable is allowed only when marker=test or marker=dev.
prod marker always refuses.
```

Dev reset remains explicit:

```bash
bun run db:reset:dev
bun run db:push:dev
bun run db:seed:dev
```

### 3.7 Bun Env Loading

Add root `bunfig.toml`:

```toml
env = false
```

This is not the primary safety boundary. It only removes a confusing implicit input source.

After this, commands that need env must pass it deliberately:

```bash
REFLECTA_DB_PATH=/tmp/reflecta.db bun run ...
```

Local `.env*.local` files should not determine Reflecta data targets.

## 4. Target Flow

### 4.1 Packaged Electron

```txt
app.isPackaged=true
  -> resolveReflectaRuntime(kind=electron)
  -> dataEnvironment=prod
  -> read prod app config
  -> open prod DB
  -> run migrations
```

### 4.2 Electron Dev

```txt
app.isPackaged=false
  -> resolveReflectaRuntime(kind=electron)
  -> dataEnvironment=dev
  -> read dev app config
  -> open dev DB
  -> no automatic prod migration
```

### 4.3 CLI

```txt
reflecta --db /path/to/reflecta.db search "query"
  -> resolveReflectaRuntime(kind=cli, dbPath=/path/to/reflecta.db)
  -> open explicit DB
  -> no automatic migration
```

No implicit CLI DB discovery:

```txt
reflecta search "query"
  -> error: DB path required
```

### 4.4 Test

```txt
vitest setup
  -> mktemp
  -> create test DB
  -> write marker data_environment=test
  -> seed
  -> pass explicit REFLECTA_DB_PATH
```

Tests should assert that resolved DB paths never point to:

```txt
~/Library/Application Support/reflecta
~/root/knowledge_base/reflecta-prod
```

## 5. Migration Plan

### Phase 1: Stop Accidental Entrypoints

- Delete root `prod:gui` and `prod:cli` scripts.
- Add `bunfig.toml` with `env = false`.
- Remove `.env.production.local` from local dev workflow documentation.
- Update docs to say production user data is not selected by `REFLECTA_PROFILE`.

### Phase 2: Introduce Runtime Resolver

- Add shared runtime resolver module.
- Move path naming rules into the resolver.
- Add resolver matrix tests:
  - packaged Electron -> prod paths, migration auto.
  - Electron dev -> dev paths, migration disabled.
  - CLI with dbPath -> explicit DB, migration disabled.
  - CLI without dbPath -> validation error.
  - script dev/test -> non-prod only.

### Phase 3: Migrate Electron

- Replace `getReflectaProfile()`, `getAppConfigDir()`, `getContentStorageRoot()` internals with resolver output.
- Replace `profile === "prod"` migration checks with `runtime.migrationPolicy`.
- Keep public function names temporarily if that reduces callsite churn.
- Delete old profile semantics after callsites converge.

### Phase 4: Migrate CLI

- Remove `apps/cli/src/profile.ts` prod discovery behavior.
- Add `--db <path>` global option.
- Keep `REFLECTA_DB_PATH` as env equivalent.
- Remove `reflecta-config.json` based DB discovery.
- Keep config-dir only for retrieval / AI config.

### Phase 5: Add DB Marker

- Add `_reflecta_store` table to base schema / migration.
- Mark new dev/test/prod databases on creation.
- Add runtime validation before destructive commands and before migration.
- Add refusal tests for test/seed opening prod marker.

### Phase 6: Harden Seed and Scripts

- Make `seed-test-data.ts` refuse existing DB by default.
- Require explicit disposable reset flag for dev/test.
- Update `dev-db.ts` to use runtime resolver target `dev`.
- Update `drizzle.config.ts` to require explicit dev DB path from `dev-db.ts`.

### Phase 7: Documentation Cleanup

- Rewrite data migration doc:
  - remove "CLI defaults to prod".
  - document production migration ownership.
  - document CLI explicit DB policy.
- Update testing doc with DB marker and temp DB rules.
- Update CLI README with `--db`.

## 6. Acceptance Criteria

The architecture is complete when these are true:

- No source file reads `REFLECTA_PROFILE`.
- No CLI path resolver reads production desktop `reflecta-config.json` to discover a DB.
- Packaged Electron is the only runtime that can automatically migrate prod DB.
- Tests and seed scripts cannot truncate or write a DB marked `prod`.
- `NODE_ENV=production bun ...` cannot change Reflecta's data target.
- `bun run test` cannot write outside temporary test directories.
- A developer can still deliberately inspect prod data with:

```bash
reflecta --db /absolute/path/to/prod/reflecta.db ...
```

but the target is explicit in the command.

## 7. Non-Goals

This plan does not:

- Add multi-user auth or OS-level sandboxing.
- Encrypt the SQLite database.
- Build a full backup/restore product workflow.
- Remove Electron user setting for Content Storage Root.
- Make CLI impossible to use with prod data. It only makes prod data explicit.

## 8. Risks

### CLI Compatibility

Existing CLI users may rely on implicit prod DB discovery.

Mitigation:

- Release note calls out the breaking change.
- Error message shows the exact replacement:

```txt
Set REFLECTA_DB_PATH or pass --db /absolute/path/to/reflecta.db.
```

### Migration Marker on Existing Databases

Existing prod databases do not have `_reflecta_store`.

Mitigation:

- Packaged Electron writes `data_environment=prod` during the next successful migration/open.
- Dev/test scripts write marker when creating disposable DBs.
- Unknown marker is treated as unsafe for destructive scripts.

### Temporary Duplication During Migration

Electron config functions may temporarily wrap resolver output while callsites are converted.

Mitigation:

- Keep wrappers shallow and delete them after Phase 4.
- Resolver tests become the source of truth.

## 9. Final Shape

The final code should read like this:

```txt
Runtime Resolver owns environment and paths.
DB initializer owns opening SQLite and applying an explicit migration policy.
Electron owns production user data.
CLI owns explicit database-file operations.
Scripts own disposable dev/test databases.
```

No caller should need to know how `reflecta`, `reflecta-dev`, app config, content storage, retrieval index, and database path are related. That complexity belongs behind the runtime resolver interface.
