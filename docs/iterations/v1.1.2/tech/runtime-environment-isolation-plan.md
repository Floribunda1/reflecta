# v1.1.2 运行环境隔离计划

> 日期：2026-06-25
>
> 状态：Draft
>
> 目标：重新设计 Reflecta 的 dev / test / prod 环境边界，把“运行形态”“数据目标”“迁移权限”拆开，永久杜绝源码态、测试态或脚本态误读/误写生产数据。

## 1. 结论

这次问题不是 `.env.production.local` 的单点事故，也不是某个 CLI 测试缺少 guard。

真正的问题是当前系统把三个不同概念压进了一个 `REFLECTA_PROFILE=dev|prod`：

```txt
运行形态：source / test / packaged
数据目标：dev store / test store / prod user store
迁移权限：是否允许自动升级数据库 schema
```

这导致任意源码态 Bun 进程只要拿到 `REFLECTA_PROFILE=prod`，就可能走到：

```txt
prod profile
  -> ~/Library/Application Support/reflecta/reflecta-config.json
  -> contentStorageRoot
  -> reflecta-prod/reflecta.db
  -> migration / write / seed / test fixture
```

最终架构应该改成：

```txt
生产数据不是一个 profile。
生产数据是一种能力，只能由明确授权的生产入口获得。
```

核心规则：

- 打包后的 Electron app 是唯一可以默认使用生产数据的入口。
- CLI 的主目标是显式的 Content Storage Root，不是隐式发现某个生产 DB。
- Test / seed / dev-db script 只能操作 test/dev store。
- Migration 权限不再由 `profile === "prod"` 推导，而由运行时策略明确授予。

## 2. 术语

### 2.1 App Config Dir

应用配置目录，存放 `reflecta-config.json`、模型配置、AI provider 配置等。

它回答的问题是：

```txt
这个运行时从哪里读应用配置？
```

它不应该回答：

```txt
用户数据在哪里？
```

### 2.2 Content Storage Root

Reflecta 数据目录，是产品层面的数据目标。

它包含：

```txt
contentStorageRoot/
  reflecta.db
  retrieval-index/
  assets/
  Sessions/
  logs/
```

Semantic search 让这个概念更重要：CLI 不只是打开 SQLite 文件，还需要同一个 store 下的 retrieval index。

### 2.3 Database Path

SQLite 文件路径，通常是：

```txt
<contentStorageRoot>/reflecta.db
```

它是 Content Storage Root 的派生值，不应该是普通 CLI 用户面对的主接口。

### 2.4 Data Environment

数据环境：

```txt
prod | dev | test
```

它描述数据本身的用途，不描述代码是否 production build。

### 2.5 Runtime Kind

运行形态：

```txt
electron-packaged | electron-dev | cli | test | script
```

它描述当前入口是谁。

### 2.6 Migration Policy

迁移策略：

```txt
auto | disabled | dev-only
```

它描述当前入口是否允许自动执行 schema migration。

## 3. 设计原则

### 3.1 `NODE_ENV` 不能决定用户数据

Bun 会自动加载 `.env*` 文件，并根据 `NODE_ENV` 加载 production / development / test 变体。

所以 `NODE_ENV=production` 只能影响构建工具或框架模式，不能影响 Reflecta 数据目标。

### 3.2 删除共享 `profile`

`profile` 这个词已经承载太多含义。最终代码里不应该继续用：

```txt
REFLECTA_PROFILE=dev|prod
```

替代为显式运行时模型：

```ts
type RuntimeKind = "electron-packaged" | "electron-dev" | "cli" | "test" | "script";
type DataEnvironment = "prod" | "dev" | "test";
type MigrationPolicy = "auto" | "disabled" | "dev-only";
```

### 3.3 路径解析必须成为深模块

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
  -> appConfigDir / contentStorageRoot / dbPath / retrievalIndexPath / migrationPolicy
```

调用方只能消费解析结果，不能自己拼 `reflecta`、`reflecta-dev`、`reflecta.db`、`retrieval-index`。

### 3.4 CLI 主接口必须表达产品数据目标

CLI 现在已经有 semantic search。它操作的不是单个 SQLite 文件，而是一个 Reflecta data store。

所以 CLI 主接口应该是：

```bash
reflecta --content-root /absolute/path/to/reflecta-store search "query"
```

而不是：

```bash
reflecta --db /absolute/path/to/reflecta.db search "query"
```

`--db` 可以保留给低层调试、Drizzle、一次性脚本，但普通产品命令应该使用 Content Storage Root。

## 4. 目标架构

### 4.1 运行时解析器

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
      contentStorageRoot?: string;
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
  contentStorageRoot: string;
  dbPath: string;
  retrievalIndexPath: string;
  assetsDir: string;
  migrationPolicy: MigrationPolicy;
};
```

核心派生规则：

```txt
contentStorageRoot
  -> dbPath = <contentStorageRoot>/reflecta.db
  -> retrievalIndexPath = <contentStorageRoot>/retrieval-index
  -> assetsDir = <contentStorageRoot>/assets
```

只有低层工具传入 `dbPath` 时，resolver 才允许从 `dirname(dbPath)` 派生临时 `contentStorageRoot`，并且必须把这种结果标记为 `db-only` 或 `explicit-db`，避免误当作完整 store。

### 4.2 Electron 规则

打包 Electron：

```txt
isPackaged=true
  -> dataEnvironment=prod
  -> appConfigDir=userDataDir
  -> contentStorageRoot from app config or userDataDir
  -> migrationPolicy=auto
```

开发 Electron：

```txt
isPackaged=false
  -> dataEnvironment=dev
  -> appConfigDir=<appData>/reflecta-dev
  -> contentStorageRoot from dev app config or <appData>/reflecta-dev
  -> migrationPolicy=disabled
```

Electron dev 不能通过 env 切到 prod。开发者如果需要查看生产数据，必须走显式 CLI 工具，而不是 `bun run dev`。

### 4.3 CLI 规则

CLI 不再做这种隐式发现：

```txt
no REFLECTA_DB_PATH
  -> read ~/Library/Application Support/reflecta/reflecta-config.json
  -> derive prod DB
```

新的普通产品命令规则：

```txt
reflecta CLI requires --content-root or REFLECTA_CONTENT_STORAGE_ROOT.
```

推荐命令：

```bash
reflecta --content-root /absolute/path/to/reflecta-store search "query"
```

兼容低层命令：

```bash
reflecta --db /absolute/path/to/reflecta.db meta
```

但 `--db` 不应该成为 search / agent retrieval 的主路径。因为 semantic search 还需要 retrieval index，而 retrieval index 应该与 DB 位于同一个 Content Storage Root。

`REFLECTA_APP_CONFIG_DIR` 仍然可以用于读取 AI / retrieval provider 配置，但它不能决定数据目录。

### 4.4 Script 规则

Dev/test script 必须声明 target：

```txt
target=dev
  -> dev contentStorageRoot
  -> migrationPolicy=dev-only

target=test
  -> temp contentStorageRoot
  -> migrationPolicy=dev-only
```

Script 不能读取生产 app config 来发现数据目录。

### 4.5 Migration Policy 单独建模

替换：

```ts
runMigrations: getReflectaProfile() === "prod";
```

改成：

```ts
runMigrations: runtime.migrationPolicy === "auto";
```

策略含义：

```txt
auto
  只允许打包 Electron 生产运行时使用。

dev-only
  只允许 dev/test script 创建或重建可丢弃数据库。

disabled
  CLI、测试 setup 之后、Electron dev。
```

这样源码态 CLI 不会因为读到某个 prod env 值就自动升级用户 DB。

### 4.6 数据环境标记

新增 metadata 表：

```sql
CREATE TABLE IF NOT EXISTS _reflecta_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

必填键：

```txt
data_environment = prod | dev | test
```

运行时检查：

```txt
electron-packaged 可以打开 prod。
electron-dev 只能默认打开 dev。
cli 可以打开显式 contentStorageRoot，但写 prod 需要额外确认。
test/script 不能打开 prod。
seed 不能 truncate prod。
```

这个标记很重要，因为路径名不是安全边界。生产 DB 可以被复制或改名，DB 自身必须携带数据环境。

### 4.7 Seed 默认不能破坏已有数据

当前 seed 行为会在已有 DB 上执行 truncate，再插入 fixture。这个行为不能继续作为默认。

新规则：

```txt
seed-test-data 只创建或填充可丢弃数据库。
seed-test-data 遇到已有 DB 默认拒绝。
只有传入 --reset-disposable 才允许清空。
--reset-disposable 只允许 marker=dev 或 marker=test。
marker=prod 永远拒绝。
```

Dev reset 继续保持显式：

```bash
bun run db:reset:dev
bun run db:push:dev
bun run db:seed:dev
```

### 4.8 Bun Env 自动加载

根目录增加 `bunfig.toml`：

```toml
env = false
```

这不是主要安全边界，只是移除一个隐式输入源。

之后需要 env 的命令必须显式传：

```bash
REFLECTA_CONTENT_STORAGE_ROOT=/tmp/reflecta-store bun run ...
```

本地 `.env*.local` 文件不应该决定 Reflecta 数据目标。

## 5. 目标流程

### 5.1 打包 Electron

```txt
app.isPackaged=true
  -> resolveReflectaRuntime(kind=electron)
  -> dataEnvironment=prod
  -> 读取 prod app config
  -> 解析 contentStorageRoot
  -> 打开 <contentStorageRoot>/reflecta.db
  -> 使用 <contentStorageRoot>/retrieval-index
  -> 自动执行 migration
```

### 5.2 Electron Dev

```txt
app.isPackaged=false
  -> resolveReflectaRuntime(kind=electron)
  -> dataEnvironment=dev
  -> 读取 dev app config
  -> 解析 dev contentStorageRoot
  -> 打开 dev DB
  -> 不自动迁移 prod DB
```

### 5.3 CLI Search

```txt
reflecta --content-root /path/to/reflecta-store search "query"
  -> resolveReflectaRuntime(kind=cli, contentStorageRoot=/path/to/reflecta-store)
  -> dbPath=<contentRoot>/reflecta.db
  -> retrievalIndexPath=<contentRoot>/retrieval-index
  -> 打开显式 store
  -> 不自动 migration
```

没有隐式 CLI 数据发现：

```txt
reflecta search "query"
  -> error: content root required
```

### 5.4 CLI 低层 DB 工具

```txt
reflecta --db /path/to/reflecta.db meta
  -> resolveReflectaRuntime(kind=cli, dbPath=/path/to/reflecta.db)
  -> explicit-db mode
  -> 只允许 DB-only command
```

如果 command 需要 semantic search、assets 或 retrieval index，则必须拒绝 `--db`，要求 `--content-root`。

### 5.5 Test

```txt
vitest setup
  -> mktemp contentStorageRoot
  -> create <tmp>/reflecta.db
  -> write marker data_environment=test
  -> seed
  -> pass explicit contentStorageRoot / dbPath to tested process
```

测试必须断言解析结果不指向：

```txt
~/Library/Application Support/reflecta
<projectRoot>/.local/reflecta-prod
```

## 6. 迁移计划

### Phase 1：停止误触入口

- 删除根目录 `prod:gui` 和 `prod:cli` scripts。
- 增加 `bunfig.toml`，设置 `env = false`。
- 清理本地开发文档里的 `.env.production.local` workflow。
- 更新文档：生产用户数据不是由 `REFLECTA_PROFILE` 选择。

### Phase 2：引入运行时解析器

- 新增共享 runtime resolver 模块。
- 把路径命名规则移动进 resolver。
- 增加 resolver matrix tests：
  - 打包 Electron -> prod content root，migration auto。
  - Electron dev -> dev content root，migration disabled。
  - CLI with content root -> explicit store，migration disabled。
  - CLI without content root/db -> validation error。
  - CLI with db path -> explicit-db mode，只允许 DB-only command。
  - script dev/test -> non-prod only。

### Phase 3：迁移 Electron

- 用 resolver 输出替换 `getReflectaProfile()`、`getAppConfigDir()`、`getContentStorageRoot()` 内部实现。
- 用 `runtime.migrationPolicy` 替换 `profile === "prod"`。
- 为减少 callsite churn，可以暂时保留旧函数名作为 wrapper。
- callsite 收敛后删除旧 profile 语义。

### Phase 4：迁移 CLI

- 删除 `apps/cli/src/profile.ts` 里的 prod discovery 行为。
- 新增全局 `--content-root <dir>`。
- 保留 `REFLECTA_CONTENT_STORAGE_ROOT` 作为 env 等价入口。
- 新增低层 `--db <path>`，只用于 DB-only command。
- 删除基于 `reflecta-config.json` 的 DB discovery。
- `REFLECTA_APP_CONFIG_DIR` 只用于读取 retrieval / AI 配置。

### Phase 5：加入 DB 环境标记

- 在 base schema / migration 中加入 `_reflecta_store`。
- 新建 dev/test/prod DB 时写入 `data_environment`。
- destructive command 和 migration 前做 marker 校验。
- 增加 test/seed 拒绝 prod marker 的测试。

### Phase 6：加固 Seed 和 Scripts

- `seed-test-data.ts` 默认拒绝已有 DB。
- dev/test reset 必须使用显式 `--reset-disposable`。
- `dev-db.ts` 改用 runtime resolver 的 `target=dev`。
- `drizzle.config.ts` 只接受 `dev-db.ts` 传入的显式 dev DB path。

### Phase 7：清理文档

- 重写 data migration 文档：
  - 删除 “CLI defaults to prod”。
  - 记录 production migration ownership。
  - 记录 CLI explicit content root policy。
- 更新 testing 文档，加入 DB marker 和 temp content root 规则。
- 更新 CLI README，说明 `--content-root` 和低层 `--db` 的区别。

## 7. 验收标准

架构完成时必须满足：

- 没有源码读取 `REFLECTA_PROFILE`。
- CLI 不会读取生产桌面 `reflecta-config.json` 来发现数据目录。
- 普通 CLI 产品命令以 `contentStorageRoot` 为主接口。
- 需要 semantic search 的 CLI 命令不能只用 `dbPath` 运行。
- 打包 Electron 是唯一可以自动迁移 prod DB 的运行时。
- Tests 和 seed scripts 不能 truncate 或写入 marker=prod 的 DB。
- `NODE_ENV=production bun ...` 不能改变 Reflecta 数据目标。
- `bun run test` 不能写入临时测试目录之外。
- 开发者仍然可以显式查看生产数据：

```bash
reflecta --content-root /absolute/path/to/reflecta-prod search "query"
```

目标必须在命令里显式出现。

## 8. 不做什么

这份计划不做：

- 不做多用户权限系统。
- 不做 OS 级 sandbox。
- 不加密 SQLite 数据库。
- 不构建完整备份/恢复产品流程。
- 不删除 Electron 里用户选择 Content Storage Root 的能力。
- 不禁止 CLI 访问 prod 数据，只要求访问目标显式化。

## 9. 风险

### 9.1 CLI 兼容性

已有 CLI 用户可能依赖隐式 prod DB discovery。

缓解：

- Release note 明确说明 breaking change。
- 错误信息给出替代命令：

```txt
Pass --content-root /absolute/path/to/reflecta-store.
For DB-only commands, pass --db /absolute/path/to/reflecta.db.
```

### 9.2 既有数据库没有 marker

已有 prod DB 没有 `_reflecta_store`。

缓解：

- 打包 Electron 在下一次成功打开或 migration 后写入 `data_environment=prod`。
- Dev/test script 创建 disposable DB 时写入 marker。
- destructive script 遇到 unknown marker 默认拒绝。

### 9.3 迁移期会有短暂 wrapper

Electron config 函数可能暂时包一层 resolver 输出。

缓解：

- wrapper 只做兼容，不新增逻辑。
- resolver tests 成为路径规则的唯一事实源。
- Phase 4 后删除旧 profile wrapper。

## 10. 最终代码形态

最终代码应该读起来像这样：

```txt
运行时解析器负责环境和路径。
DB initializer 负责打开 SQLite 和应用显式 migration policy。
Electron 负责生产用户数据。
CLI 负责显式 Reflecta store 操作。
Scripts 负责可丢弃 dev/test store。
```

任何调用方都不应该需要知道 `reflecta`、`reflecta-dev`、app config、content storage、retrieval index、assets、database path 之间如何关联。

这些复杂性应该全部藏在运行时解析器的 interface 后面。
