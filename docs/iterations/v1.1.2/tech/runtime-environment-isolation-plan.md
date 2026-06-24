# v1.1.2 运行环境隔离计划

> 日期：2026-06-25
>
> 状态：Draft
>
> 目标：重新设计 Reflecta 的运行环境模型，让生产 Electron 和生产 CLI 默认同源访问生产数据，同时防止源码态、测试态和脚本态误读/误写生产数据。

## 1. 结论

这次问题不是 `.env.production.local` 的单点事故，也不是某个测试缺少 guard。

真正的问题是当前系统把不同维度压进了一个 `REFLECTA_PROFILE=dev|prod`。`prod` 同时被拿来表示：

```txt
这是生产构建？
这是生产数据？
允许自动迁移？
应该读生产 app config？
```

这些问题不能用一个 profile 回答。

最终架构应该拆成三条轴：

```txt
运行入口类型 Process Kind：electron | cli | test | script
构建类型 Build Kind：release | source
数据目标 Data Target：prod | dev | test
```

其中：

- `Process Kind` 回答“谁在运行”。
- `Build Kind` 回答“这是正式发布产物，还是源码/开发态进程”。
- `Data Target` 回答“这次运行最终读写哪一套 Reflecta 数据”。

核心规则：

- `electron + release` 默认使用生产数据。
- `cli + release` 默认使用同一套生产数据。
- `electron + source` 默认使用开发数据。
- `cli + source` 默认使用开发数据。
- `test` 只能使用测试数据。
- `script` 只能使用显式 dev/test 数据。
- `NODE_ENV`、`.env.production.local`、普通环境变量不能把 source 进程变成 release 进程。

这保证第三方 agent 可以直接调用生产 CLI：

```bash
reflecta search "query"
```

同时也保证源码态命令不会因为环境变量污染而写进生产数据。

## 2. 三条轴

### 2.1 Process Kind

`Process Kind` 是运行入口类型：

```txt
electron
cli
test
script
```

它只描述“谁在运行”，不描述是不是生产，也不描述应该读哪套数据。

示例：

```txt
Electron 桌面应用 -> electron
reflecta 命令行 -> cli
Vitest / Playwright -> test
dev-db / seed-test-data -> script
```

### 2.2 Build Kind

`Build Kind` 是构建类型：

```txt
release
source
```

它只适用于产品入口：

```txt
electron + release
electron + source
cli + release
cli + source
```

`release` 表示正式发布产物。`source` 表示源码态、开发态或本地调试态。

不要再把 `packaged` 和 `release` 并列。`packaged` 只是 Electron 判断 `Build Kind = release` 的实现细节：

```txt
Electron: app.isPackaged === true -> Build Kind = release
Electron: app.isPackaged === false -> Build Kind = source
```

CLI 需要自己的发布标记：

```txt
已发布 / 已安装 CLI 构建产物 -> Build Kind = release
源码 TS / 本地开发入口 -> Build Kind = source
```

CLI 的 release 标记必须由构建产物内置，不能由运行时 env 覆盖。

### 2.3 Data Target

`Data Target` 是数据目标：

```txt
prod
dev
test
```

它描述这次运行最终要读写哪一套 Reflecta 数据。

数据目标不是抽象标签，它具体用于解析：

```txt
App Config Dir
Content Storage Root
Database Path
Retrieval Index Path
Assets Dir
Sessions / logs 目录
Migration Policy
Seed / truncate 是否允许
```

生产数据目标示例：

```txt
prod app config:
  ~/Library/Application Support/reflecta/reflecta-config.json

contentStorageRoot:
  <projectRoot>/.local/reflecta-prod

derived paths:
  <projectRoot>/.local/reflecta-prod/reflecta.db
  <projectRoot>/.local/reflecta-prod/retrieval-index
  <projectRoot>/.local/reflecta-prod/assets
```

开发和测试也一样，只是指向不同目录：

```txt
dev -> reflecta-dev app config + dev content root
test -> /tmp 下的临时 content root
```

## 3. 默认解析矩阵

| Process Kind | Build Kind | 默认 Data Target | 默认 App Config Dir  | 自动 Migration |
| ------------ | ---------- | ---------------- | -------------------- | -------------- |
| electron     | release    | prod             | 生产 app config      | 是             |
| cli          | release    | prod             | 生产 app config      | 是             |
| electron     | source     | dev              | 开发 app config      | 否             |
| cli          | source     | dev              | 开发 app config      | 否             |
| test         | 无         | test             | 测试临时 config      | 仅测试初始化   |
| script       | 无         | dev/test         | 显式 dev/test config | 仅 dev/test    |

关键点：

- 生产 Electron 和生产 CLI 同级，都默认读同一个生产 app config。
- 源码 Electron 和源码 CLI 同级，都默认读开发 app config。
- `NODE_ENV=production` 不能改变这张表。
- `.env.production.local` 不能改变这张表。
- 要调试其他数据目录，必须显式传入命令参数。

## 4. 路径概念

### 4.1 App Config Dir

应用配置目录，存放 `reflecta-config.json`、模型配置、AI provider 配置等。

它回答：

```txt
这个运行时从哪里读应用配置？
```

生产 Electron 和生产 CLI 应该读取同一个生产 App Config Dir。

### 4.2 Content Storage Root

Reflecta 用户数据目录，是产品层面的主数据目标。

它包含：

```txt
contentStorageRoot/
  reflecta.db
  retrieval-index/
  assets/
  Sessions/
  logs/
```

CLI 现在有 semantic search，所以 CLI 操作的是完整 Content Storage Root，不是单个 SQLite 文件。

### 4.3 Database Path

SQLite 文件路径，通常是：

```txt
<contentStorageRoot>/reflecta.db
```

它是 Content Storage Root 的派生值。`--db` 可以保留给低层 DB-only 工具，但普通 CLI 产品命令不应该把 DB path 当主接口。

### 4.4 Retrieval Index Path

语义搜索索引路径，通常是：

```txt
<contentStorageRoot>/retrieval-index
```

需要 semantic search 的命令必须运行在完整 Content Storage Root 上，不能只传 `--db`。

## 5. Runtime Resolver

路径和权限规则应该收敛进一个深模块：

```txt
packages/server/src/runtime/
  resolve.ts
  types.ts
```

外部 interface 应该表达三条轴：

```ts
type ProcessKind = "electron" | "cli" | "test" | "script";
type BuildKind = "release" | "source";
type DataTarget = "prod" | "dev" | "test";
type MigrationPolicy = "auto" | "disabled" | "dev-only";

type ResolveRuntimeInput =
  | {
      processKind: "electron";
      buildKind: BuildKind;
      appDataDir: string;
      userDataDir: string;
      explicitContentStorageRoot?: string;
      explicitAppConfigDir?: string;
    }
  | {
      processKind: "cli";
      buildKind: BuildKind;
      platformAppDataDir: string;
      explicitContentStorageRoot?: string;
      explicitDbPath?: string;
      explicitAppConfigDir?: string;
    }
  | {
      processKind: "test";
      explicitContentStorageRoot: string;
      explicitAppConfigDir: string;
    }
  | {
      processKind: "script";
      dataTarget: "dev" | "test";
      explicitContentStorageRoot?: string;
    };

type ResolvedRuntime = {
  processKind: ProcessKind;
  buildKind?: BuildKind;
  dataTarget: DataTarget;
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

只有低层工具传入 `explicitDbPath` 时，resolver 才允许进入：

```txt
storeMode = explicit-db
```

这种模式不能运行 search、retrieval、assets、agent 相关命令。

## 6. 生产 CLI 和源码 CLI

### 6.1 生产 CLI

生产 CLI 是 release 产物，和生产 Electron 同级。

默认流程：

```txt
reflecta search "query"
  -> processKind=cli
  -> buildKind=release
  -> dataTarget=prod
  -> 读取生产 App Config Dir
  -> 解析生产 Content Storage Root
  -> 打开 reflecta.db
  -> 使用 retrieval-index
  -> 允许自动 migration
```

第三方 agent 调用生产 CLI 时不需要传 `--content-root`。

### 6.2 源码 CLI

源码 CLI 是 source 进程，默认只能使用开发数据。

默认流程：

```txt
bun apps/cli/src/index.ts search "query"
  -> processKind=cli
  -> buildKind=source
  -> dataTarget=dev
  -> 读取开发 App Config Dir
  -> 解析开发 Content Storage Root
  -> 禁用自动 migration
```

即使出现：

```bash
NODE_ENV=production bun apps/cli/src/index.ts search "query"
```

也不能变成生产 CLI。

### 6.3 源码 CLI 显式调试生产数据

如果开发者确实要用源码 CLI 检查生产数据，必须显式写出目标：

```bash
bun apps/cli/src/index.ts --content-root /absolute/path/to/reflecta-prod search "query"
```

规则：

```txt
显式 --content-root + marker=prod
  -> 允许读
  -> 写入仍需 --yes
  -> 不自动 migration
```

这样生产数据目标会出现在命令里，不会由 `.env.production.local` 偷偷决定。

## 7. Release 资格

Release 资格不能从运行时 env 读取。

错误做法：

```txt
REFLECTA_RUNTIME=release
REFLECTA_PROFILE=prod
NODE_ENV=production
```

正确做法：

```txt
Electron release: app.isPackaged === true
CLI release: 构建产物内置 CLI_BUILD_CHANNEL="release"
```

源码 CLI 默认：

```ts
export const CLI_BUILD_CHANNEL = "source";
```

发布脚本生成发布产物时写入：

```ts
export const CLI_BUILD_CHANNEL = "release";
```

运行时 env 不能覆盖这个值。

## 8. Migration Policy

替换当前逻辑：

```ts
runMigrations: getReflectaProfile() === "prod";
```

改成：

```ts
runMigrations: runtime.migrationPolicy === "auto";
```

策略：

```txt
auto
  只允许：
  - electron + release
  - cli + release

disabled
  默认用于：
  - electron + source
  - cli + source
  - explicit-db mode
  - 测试初始化之后

dev-only
  只允许 dev/test script 创建或重建可丢弃数据库。
```

这解决两个问题：

- 源码 CLI 不会因为 env 污染自动升级生产 DB。
- 生产 CLI 作为正式产品入口，仍然可以和生产 Electron 一样处理生产 DB migration。

## 9. 数据环境标记

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

用途：

```txt
release runtime 默认可以打开 prod。
source runtime 默认只能打开 dev。
test/script 不能打开 prod。
seed 不能 truncate prod。
unknown marker 在 destructive script 中默认拒绝。
```

这个标记很重要，因为路径名不是安全边界。生产 DB 可以被复制或改名，DB 自身必须携带数据环境。

## 10. Seed 和脚本

当前 seed 行为会在已有 DB 上 truncate 再插入 fixture。这个行为不能继续作为默认。

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

## 11. Bun Env 自动加载不是架构输入

Bun 会自动加载 `.env*` 文件。这个行为可以保留，但 Runtime Resolver 不能依赖它来判断生产能力。

允许 env 做两类事情：

```txt
1. 传入显式 override，例如 --content-root 对应的环境变量。
2. 传入外部服务配置，例如 AI provider key。
```

不允许 env 做这些事：

```txt
1. 把 source 进程变成 release 进程。
2. 决定默认 Data Target 是 prod。
3. 授予自动 migration 权限。
```

也就是说，即使 Bun 加载了 `.env.production.local`，也不能改变这张表：

```txt
cli + source -> dev
electron + source -> dev
cli + release -> prod
electron + release -> prod
```

## 12. 迁移计划

### Phase 1：停止误触入口

- 删除根目录 `prod:gui` 和 `prod:cli` scripts。
- 清理本地开发文档里的 `.env.production.local` 工作流。
- 更新文档：生产用户数据不是由 `REFLECTA_PROFILE` 选择，而是由 `Process Kind + Build Kind` 解析出来。

### Phase 2：定义 CLI Build Kind

- 新增 CLI 构建通道模块。
- 源码默认 `CLI_BUILD_CHANNEL="source"`。
- 发布构建产物内置 `CLI_BUILD_CHANNEL="release"`。
- 构建通道不能被运行时 env 覆盖。
- 增加测试证明 `NODE_ENV=production` 不会改变构建通道。

### Phase 3：引入 Runtime Resolver

- 新增共享 runtime resolver 模块。
- 把路径命名规则移动进 resolver。
- 增加 resolver 矩阵测试：
  - electron + release -> prod data target，自动 migration。
  - cli + release -> prod data target，自动 migration。
  - electron + source -> dev data target，禁用 migration。
  - cli + source -> dev data target，禁用 migration。
  - source CLI + 显式 content root -> 显式数据目录，禁用 migration。
  - CLI + db path -> explicit-db 模式，只允许 DB-only 命令。
  - test -> test data target。
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
- `dev-db.ts` 改用 runtime resolver 的 script dev target。
- `drizzle.config.ts` 只接受 `dev-db.ts` 传入的显式 dev DB path。

### Phase 8：清理文档

- 重写 data migration 文档：
  - 删除 “CLI defaults to prod”。
  - 改为 “生产 CLI 默认 prod；源码 CLI 默认 dev”。
  - 解释 Process Kind / Build Kind / Data Target。
  - 记录 CLI content root 显式覆盖和 DB-only 模式。
- 更新 testing 文档，加入 DB marker 和临时 content root 规则。
- 更新 CLI README，说明生产 CLI 默认同源读取生产 app config。

## 13. 验收标准

架构完成时必须满足：

- 没有源码读取 `REFLECTA_PROFILE`。
- Release 资格不能由运行时 env 设置。
- `NODE_ENV=production bun ...` 不能把源码 CLI 变成生产 CLI。
- 生产 CLI 无参数时默认读取生产 App Config Dir，并和生产 Electron 同源。
- 源码 CLI 无参数时默认读取开发 App Config Dir。
- 需要 semantic search 的 CLI 命令必须运行在 full-store 模式，不能只用 `dbPath`。
- `electron + release` 和 `cli + release` 是唯二可以自动迁移 prod DB 的产品入口。
- Tests 和 seed scripts 不能 truncate 或写入 marker=prod 的 DB。
- `bun run test` 不能写入临时测试目录之外。
- 第三方 agent 可以直接调用生产 CLI：

```bash
reflecta search "query"
```

不用传入 `--content-root`。

## 14. 不做什么

这份计划不做：

- 不做多用户权限系统。
- 不做 OS 级 sandbox。
- 不加密 SQLite 数据库。
- 不构建完整备份/恢复产品流程。
- 不删除 Electron 里用户选择 Content Storage Root 的能力。
- 不禁止 CLI 访问 prod 数据；生产 CLI 默认访问 prod，源码 CLI 需要显式覆盖。

## 15. 风险

### 15.1 CLI Build Kind 设计错误

如果 CLI 构建通道可以被运行时 env 覆盖，就会重新引入同类事故。

缓解：

- build kind 由构建产物内置。
- resolver 不读取任何 `REFLECTA_RUNTIME` / `REFLECTA_PROFILE`。
- 测试覆盖 `NODE_ENV=production` 和 `.env.production.local` 场景。

### 15.2 CLI 兼容性

已有 CLI 用户可能依赖源码态 CLI 默认读生产库。

缓解：

- 发布说明明确说明：生产 CLI 保持默认读生产库，源码 CLI 改为默认 dev。
- 错误信息给出显式调试方式：

```txt
源码 CLI 默认使用开发数据目录。
如需检查其他数据目录，传入 --content-root /absolute/path/to/reflecta-store。
```

### 15.3 既有数据库没有 marker

已有 prod DB 没有 `_reflecta_store`。

缓解：

- 生产 Electron / 生产 CLI 在下一次成功打开或 migration 后写入 `data_environment=prod`。
- Dev/test script 创建可丢弃 DB 时写入 marker。
- destructive script 遇到 unknown marker 默认拒绝。

### 15.4 迁移期会有短暂 wrapper

Electron config 函数和 CLI profile 函数可能暂时包一层 resolver 输出。

缓解：

- wrapper 只做兼容，不新增逻辑。
- resolver tests 成为路径规则的唯一事实源。
- Phase 5 后删除旧 profile wrapper。

## 16. 最终代码形态

最终代码应该读起来像这样：

```txt
Runtime Resolver 负责 Process Kind / Build Kind / Data Target 的解析。
DB initializer 负责打开 SQLite 和应用显式 migration policy。
生产 Electron 和生产 CLI 共同负责生产用户数据。
源码 Electron 和源码 CLI 默认使用开发数据。
Tests 和 scripts 只能使用测试/开发数据。
```

任何调用方都不应该需要知道 `reflecta`、`reflecta-dev`、app config、content storage、retrieval index、assets、database path 之间如何关联。

这些复杂性应该全部藏在 Runtime Resolver 的 interface 后面。
