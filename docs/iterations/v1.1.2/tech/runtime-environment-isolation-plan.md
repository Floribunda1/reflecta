# v1.1.2 运行环境隔离计划

> 日期：2026-06-25
>
> 状态：Draft
>
> 目标：重新设计 Reflecta 的 dev / test / prod 环境边界，让生产 Electron 和生产 CLI 都能默认同源访问生产数据，同时永久杜绝源码态、测试态或脚本态误读/误写生产数据。

## 1. 结论

这次问题不是 `.env.production.local` 的单点事故，也不是某个 CLI 测试缺少 guard。

真正的问题是当前系统把三个不同概念压进了一个 `REFLECTA_PROFILE=dev|prod`：

```txt
运行形态：源码态 / 测试态 / 发布态
数据目标：开发数据目录 / 测试数据目录 / 生产用户数据目录
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
生产数据是一种“发布态运行时能力”。
```

核心规则：

- 生产 Electron 和生产 CLI 是同级产品入口，都可以默认使用同一个生产 App Config Dir 和生产 Content Storage Root。
- 源码 Electron、源码 CLI、test、script 不是生产入口，不能因为 env 变成生产入口。
- CLI 的产品数据目标是 Content Storage Root，不是单个 DB 文件；但生产 CLI 可以默认从生产应用配置解析这个数据目录。
- Migration 权限不再由 `profile === "prod"` 推导，而由运行时策略明确授予。

## 2. 术语

### 2.1 App Config Dir

应用配置目录，存放 `reflecta-config.json`、模型配置、AI provider 配置等。

它回答的问题是：

```txt
这个运行时从哪里读应用配置？
```

生产 Electron 和生产 CLI 应该读取同一个生产 App Config Dir。

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

Semantic search 让这个概念成为 CLI 的主数据目标：CLI 不只是打开 SQLite 文件，还需要同一个数据目录下的 retrieval index。

### 2.3 Database Path

SQLite 文件路径，通常是：

```txt
<contentStorageRoot>/reflecta.db
```

它是 Content Storage Root 的派生值。`--db` 可以作为低层调试入口存在，但不应该代表普通产品命令的数据目标。

### 2.4 Data Environment

数据环境：

```txt
prod | dev | test
```

它描述数据本身的用途，不描述代码是否 production build。

### 2.5 Runtime Kind

运行形态：

```txt
electron-release | cli-release | electron-source | cli-source | test | script
```

关键区别是发布态运行时和源码态运行时。生产能力来自发布态运行时，不来自环境变量。

### 2.6 Migration Policy

迁移策略：

```txt
auto | disabled | dev-only
```

它描述当前入口是否允许自动执行 schema migration。

## 3. 设计原则

### 3.1 生产能力不能来自 env

Bun 会自动加载 `.env*` 文件，并根据 `NODE_ENV` 加载 production / development / test 变体。

因此下面这些都不能授予生产能力：

```txt
NODE_ENV=production
REFLECTA_PROFILE=prod
REFLECTA_RUNTIME=release
```

生产能力只能来自构建产物本身：

```txt
Electron：app.isPackaged
CLI：发布构建产物内置标记
```

也就是说，源码态进程不能靠 env 伪装成生产 CLI。

### 3.2 删除共享 `profile`

`profile` 这个词已经承载太多含义。最终代码里不应该继续用：

```txt
REFLECTA_PROFILE=dev|prod
```

替代为显式运行时模型：

```ts
type RuntimeKind =
  | "electron-release"
  | "cli-release"
  | "electron-source"
  | "cli-source"
  | "test"
  | "script";

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
runtime identity
  + 显式覆盖项
  -> resolveReflectaRuntime()
  -> appConfigDir / contentStorageRoot / dbPath / retrievalIndexPath / migrationPolicy
```

调用方只能消费解析结果，不能自己拼 `reflecta`、`reflecta-dev`、`reflecta.db`、`retrieval-index`。

### 3.4 生产 CLI 是产品入口，不是低层工具

生产 CLI 的定位是给用户和第三方 agent 调用的一等生产入口。它应该支持：

```bash
reflecta search "query"
reflecta understanding create --title "..." --body "..." --yes
```

默认行为应该和生产 Electron 同源：

```txt
production App Config Dir
  -> reflecta-config.json
  -> contentStorageRoot
  -> reflecta.db + retrieval-index + assets
```

`--content-root` 是显式覆盖项，不是生产 CLI 的必填参数。

### 3.5 Source CLI 默认不能碰 prod

源码态 CLI 可以用于开发和测试，但不能默认读取生产 app config。

源码态 CLI 默认规则：

```txt
cli-source
  -> dev App Config Dir
  -> dev Content Storage Root
  -> migrationPolicy=disabled
```

如果开发者确实要用源码 CLI 调试生产数据，必须显式传入：

```bash
bun apps/cli/src/index.ts --content-root /absolute/path/to/reflecta-prod ...
```

这种显式覆盖必须出现在命令里，不能来自 `.env.production.local`。

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
      explicitContentStorageRoot?: string;
      explicitAppConfigDir?: string;
    }
  | {
      kind: "cli";
      buildChannel: "release" | "source";
      platformAppDataDir: string;
      explicitContentStorageRoot?: string;
      explicitDbPath?: string;
      explicitAppConfigDir?: string;
    }
  | {
      kind: "script";
      target: "dev" | "test";
      explicitContentStorageRoot?: string;
    };

type ResolvedRuntime = {
  runtimeKind: RuntimeKind;
  dataEnvironment: DataEnvironment;
  appConfigDir: string;
  contentStorageRoot: string;
  dbPath: string;
  retrievalIndexPath: string;
  assetsDir: string;
  migrationPolicy: MigrationPolicy;
  storeMode: "full-store" | "explicit-db";
};
```

核心派生规则：

```txt
contentStorageRoot
  -> dbPath = <contentStorageRoot>/reflecta.db
  -> retrievalIndexPath = <contentStorageRoot>/retrieval-index
  -> assetsDir = <contentStorageRoot>/assets
```

只有低层工具传入 `explicitDbPath` 时，resolver 才允许进入 `storeMode=explicit-db`。这种模式不能运行需要 semantic search、retrieval index 或 assets 的命令。

### 4.2 发布资格

发布资格不能从运行时 env 读取。

Electron：

```txt
app.isPackaged=true
  -> electron-release

app.isPackaged=false
  -> electron-source
```

CLI：

```txt
已发布 / 已安装的 CLI 构建产物
  -> cli-release

源码 TS / 本地开发入口
  -> cli-source
```

CLI 发布标记应该由发布构建产物内置，例如：

```ts
export const CLI_BUILD_CHANNEL = "release";
```

源码默认值是：

```ts
export const CLI_BUILD_CHANNEL = "source";
```

发布脚本负责生成发布构建标记。运行时 env 不能覆盖它。

### 4.3 Electron 规则

生产 Electron：

```txt
electron-release
  -> dataEnvironment=prod
  -> appConfigDir=userDataDir
  -> contentStorageRoot 来自生产应用配置或 userDataDir
  -> migrationPolicy=auto
```

开发 Electron：

```txt
electron-source
  -> dataEnvironment=dev
  -> appConfigDir=<appData>/reflecta-dev
  -> contentStorageRoot 来自开发应用配置或 <appData>/reflecta-dev
  -> migrationPolicy=disabled
```

Electron source 不能通过 env 切到 prod。

### 4.4 CLI 规则

生产 CLI：

```txt
cli-release
  -> dataEnvironment=prod
  -> appConfigDir=<platform app data>/reflecta
  -> contentStorageRoot 来自生产应用配置或 appConfigDir
  -> migrationPolicy=auto
```

这让生产 CLI 和生产 Electron 同源：

```txt
release Electron
release CLI
  -> 同一个生产应用配置
  -> 同一个生产 contentStorageRoot
```

源码 CLI：

```txt
cli-source
  -> dataEnvironment=dev
  -> appConfigDir=<platform app data>/reflecta-dev
  -> contentStorageRoot 来自开发应用配置或 appConfigDir
  -> migrationPolicy=disabled
```

CLI 显式覆盖：

```txt
--content-root <dir>
  -> 显式指定完整 Reflecta 数据目录

--db <path>
  -> explicit-db 模式
  -> 只允许 DB-only 命令
```

`REFLECTA_APP_CONFIG_DIR` 仍然可以作为显式配置覆盖项，但只有生产 CLI 默认读取生产应用配置。源码 CLI 不会因为 `.env.production.local` 读取生产应用配置。

### 4.5 Script 规则

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

### 4.6 Migration Policy 单独建模

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
  只允许发布态运行时使用：
  - electron-release
  - cli-release

dev-only
  只允许 dev/test script 创建或重建可丢弃数据库。

disabled
  源码态运行时、测试 setup 之后、explicit-db 模式。
```

这样源码态 CLI 不会因为读到某个 prod env 值就自动升级用户 DB；但生产 CLI 作为发布态运行时，可以和生产 Electron 一样承担 schema migration。

### 4.7 数据环境标记

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
electron-release 可以默认打开 prod。
cli-release 可以默认打开 prod。
electron-source 默认只能打开 dev。
cli-source 默认只能打开 dev。
test/script 不能打开 prod。
seed 不能 truncate prod。
```

显式覆盖规则：

```txt
源码态运行时 + 显式 --content-root + marker=prod
  -> 允许读
  -> 写入仍需 CLI mutating confirmation
  -> 不自动 migration
```

这个标记很重要，因为路径名不是安全边界。生产 DB 可以被复制或改名，DB 自身必须携带数据环境。

### 4.8 Seed 默认不能破坏已有数据

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

### 4.9 Bun Env 自动加载

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

### 5.1 生产 Electron

```txt
app.isPackaged=true
  -> resolveReflectaRuntime(kind=electron, isPackaged=true)
  -> runtimeKind=electron-release
  -> dataEnvironment=prod
  -> 读取生产应用配置
  -> 解析 contentStorageRoot
  -> 打开 <contentStorageRoot>/reflecta.db
  -> 使用 <contentStorageRoot>/retrieval-index
  -> 自动执行 migration
```

### 5.2 生产 CLI

```txt
reflecta search "query"
  -> resolveReflectaRuntime(kind=cli, buildChannel=release)
  -> runtimeKind=cli-release
  -> dataEnvironment=prod
  -> 读取同一个生产应用配置
  -> 解析同一个 prod contentStorageRoot
  -> 打开 <contentStorageRoot>/reflecta.db
  -> 使用 <contentStorageRoot>/retrieval-index
  -> 自动执行 migration
```

第三方 agent 调用生产 CLI 时不需要传 `--content-root`。

### 5.3 Electron Dev

```txt
app.isPackaged=false
  -> resolveReflectaRuntime(kind=electron, isPackaged=false)
  -> runtimeKind=electron-source
  -> dataEnvironment=dev
  -> 读取开发应用配置
  -> 解析 dev contentStorageRoot
  -> 不自动迁移 prod DB
```

### 5.4 Source CLI

```txt
bun apps/cli/src/index.ts search "query"
  -> resolveReflectaRuntime(kind=cli, buildChannel=source)
  -> runtimeKind=cli-source
  -> dataEnvironment=dev
  -> 读取开发应用配置
  -> 解析 dev contentStorageRoot
  -> 不自动 migration
```

即使出现：

```bash
NODE_ENV=production bun apps/cli/src/index.ts search "query"
```

也不能变成生产 CLI。

### 5.5 Source CLI 显式调试生产数据

```txt
bun apps/cli/src/index.ts --content-root /path/to/reflecta-prod search "query"
  -> 显式 content root
  -> marker=prod
  -> 允许读
  -> 不自动 migration
```

如果是写命令，仍然必须走 CLI 现有 mutating confirmation，例如 `--yes`。

### 5.6 CLI 低层 DB 工具

```txt
reflecta --db /path/to/reflecta.db meta
  -> resolveReflectaRuntime(kind=cli, explicitDbPath=/path/to/reflecta.db)
  -> storeMode=explicit-db
  -> 只允许 DB-only 命令
```

如果 command 需要 semantic search、assets 或 retrieval index，则必须拒绝 `--db`，要求完整 Content Storage Root。

### 5.7 Test

```txt
vitest setup
  -> mktemp contentStorageRoot
  -> create <tmp>/reflecta.db
  -> 写入 marker data_environment=test
  -> seed
  -> pass explicit contentStorageRoot / dbPath to tested process
```

测试必须断言 source/test 解析结果不指向：

```txt
~/Library/Application Support/reflecta
<projectRoot>/.local/reflecta-prod
```

## 6. 迁移计划

### Phase 1：停止误触入口

- 删除根目录 `prod:gui` 和 `prod:cli` scripts。
- 增加 `bunfig.toml`，设置 `env = false`。
- 清理本地开发文档里的 `.env.production.local` 工作流。
- 更新文档：生产用户数据不是由 `REFLECTA_PROFILE` 选择，而是由发布态运行时获得。

### Phase 2：定义 CLI 发布标记

- 新增 CLI 构建通道模块。
- 源码默认 `CLI_BUILD_CHANNEL="source"`。
- 发布构建产物内置 `CLI_BUILD_CHANNEL="release"`。
- 发布标记不能被运行时 env 覆盖。
- 增加测试证明 `NODE_ENV=production` 不会改变构建通道。

### Phase 3：引入运行时解析器

- 新增共享 runtime resolver 模块。
- 把路径命名规则移动进 resolver。
- 增加 resolver 矩阵测试：
  - electron-release -> 生产应用配置，生产 content root，自动 migration。
  - cli-release -> 生产应用配置，生产 content root，自动 migration。
  - electron-source -> 开发应用配置，开发 content root，禁用 migration。
  - cli-source -> 开发应用配置，开发 content root，禁用 migration。
  - 源码 CLI + 显式 content root -> 显式数据目录，禁用 migration。
  - CLI + db path -> explicit-db 模式，只允许 DB-only 命令。
  - script dev/test -> 只能使用非生产数据。

### Phase 4：迁移 Electron

- 用 resolver 输出替换 `getReflectaProfile()`、`getAppConfigDir()`、`getContentStorageRoot()` 内部实现。
- 用 `runtime.migrationPolicy` 替换 `profile === "prod"`。
- 为减少调用点改动，可以暂时保留旧函数名作为 wrapper。
- 调用点收敛后删除旧 profile 语义。

### Phase 5：迁移 CLI

- 删除 `apps/cli/src/profile.ts` 里的 env profile 行为。
- 生产 CLI 默认读取生产 App Config Dir。
- 源码 CLI 默认读取开发 App Config Dir。
- 新增全局 `--content-root <dir>` 作为显式数据目录覆盖项。
- 新增低层 `--db <path>`，只用于 DB-only 命令。
- 删除基于 `REFLECTA_PROFILE` 的 DB discovery。
- `REFLECTA_APP_CONFIG_DIR` 只作为显式配置覆盖项，不作为源码 CLI 提权通道。

### Phase 6：加入 DB 环境标记

- 在 base schema / migration 中加入 `_reflecta_store`。
- 新建 dev/test/prod DB 时写入 `data_environment`。
- destructive command 和 migration 前做 marker 校验。
- 增加 test/seed 拒绝 prod marker 的测试。

### Phase 7：加固 Seed 和 Scripts

- `seed-test-data.ts` 默认拒绝已有 DB。
- dev/test reset 必须使用显式 `--reset-disposable`。
- `dev-db.ts` 改用 runtime resolver 的 `target=dev`。
- `drizzle.config.ts` 只接受 `dev-db.ts` 传入的显式 dev DB path。

### Phase 8：清理文档

- 重写 data migration 文档：
  - 删除 “CLI defaults to prod”。
  - 改为 “生产 CLI 默认 prod；源码 CLI 默认 dev”。
  - 记录发布态运行时的 migration ownership。
  - 记录 CLI content root 显式覆盖和 DB-only 模式。
- 更新 testing 文档，加入 DB marker 和临时 content root 规则。
- 更新 CLI README，说明生产 CLI 默认同源读取生产 app config。

## 7. 验收标准

架构完成时必须满足：

- 没有源码读取 `REFLECTA_PROFILE`。
- 发布资格不能由运行时 env 设置。
- `NODE_ENV=production bun ...` 不能把源码 CLI 变成生产 CLI。
- 生产 CLI 无参数时默认读取生产 App Config Dir，并和生产 Electron 同源。
- 源码 CLI 无参数时默认读取开发 App Config Dir。
- 需要 semantic search 的 CLI 命令必须运行在 full-store 模式，不能只用 `dbPath`。
- electron-release 和 cli-release 是唯二可以自动迁移 prod DB 的运行时。
- Tests 和 seed scripts 不能 truncate 或写入 marker=prod 的 DB。
- `bun run test` 不能写入临时测试目录之外。
- 第三方 agent 可以直接调用生产 CLI：

```bash
reflecta search "query"
```

不用传入 `--content-root`。

## 8. 不做什么

这份计划不做：

- 不做多用户权限系统。
- 不做 OS 级 sandbox。
- 不加密 SQLite 数据库。
- 不构建完整备份/恢复产品流程。
- 不删除 Electron 里用户选择 Content Storage Root 的能力。
- 不禁止 CLI 访问 prod 数据；生产 CLI 默认访问 prod，源码 CLI 需要显式覆盖。

## 9. 风险

### 9.1 CLI 发布标记设计错误

如果发布标记可以被运行时 env 覆盖，就会重新引入同类事故。

缓解：

- marker 由构建产物内置。
- resolver 不读取任何 `REFLECTA_RUNTIME` / `REFLECTA_PROFILE`。
- 测试覆盖 `NODE_ENV=production` 和 `.env.production.local` 场景。

### 9.2 CLI 兼容性

已有 CLI 用户可能依赖源码态 CLI 默认读生产库。

缓解：

- 发布说明明确说明：生产 CLI 保持默认读生产库，源码 CLI 改为默认 dev。
- 错误信息给出显式调试方式：

```txt
源码 CLI 默认使用开发数据目录。
如需检查其他数据目录，传入 --content-root /absolute/path/to/reflecta-store。
```

### 9.3 既有数据库没有 marker

已有 prod DB 没有 `_reflecta_store`。

缓解：

- 生产 Electron / 生产 CLI 在下一次成功打开或 migration 后写入 `data_environment=prod`。
- Dev/test script 创建可丢弃 DB 时写入 marker。
- destructive script 遇到 unknown marker 默认拒绝。

### 9.4 迁移期会有短暂 wrapper

Electron config 函数和 CLI profile 函数可能暂时包一层 resolver 输出。

缓解：

- wrapper 只做兼容，不新增逻辑。
- resolver tests 成为路径规则的唯一事实源。
- Phase 5 后删除旧 profile wrapper。

## 10. 最终代码形态

最终代码应该读起来像这样：

```txt
运行时解析器负责 release/source 身份、环境和路径。
DB initializer 负责打开 SQLite 和应用显式 migration policy。
release Electron 和 release CLI 共同负责生产用户数据。
source Electron 和 source CLI 默认使用 dev store。
Scripts 负责可丢弃 dev/test store。
```

任何调用方都不应该需要知道 `reflecta`、`reflecta-dev`、app config、content storage、retrieval index、assets、database path 之间如何关联。

这些复杂性应该全部藏在运行时解析器的 interface 后面。
