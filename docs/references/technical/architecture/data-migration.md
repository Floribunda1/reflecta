# 数据迁移技术方案

Reflecta 使用两套策略处理数据库结构变化：

- **prod**：通过 app version 对应的 SQL migration 自动升级用户数据库。
- **dev**：通过 Drizzle schema push 重建开发库，方便频繁改 schema。

这两套流程共享同一份业务 schema，但运行时行为不同。

## 路径模型

Reflecta 区分三种路径概念：

| 概念                 | 含义                                                       | 使用方                  |
| -------------------- | ---------------------------------------------------------- | ----------------------- |
| App Config Dir       | 存放 `reflecta-config.json` 的应用配置目录                 | Electron / CLI 读取配置 |
| Content Storage Root | 用户内容数据目录，包含 `reflecta.db` 和 `assets/`          | Electron runtime        |
| Database Path        | SQLite 文件路径，通常是 `<contentStorageRoot>/reflecta.db` | CLI / Drizzle / scripts |

Electron Content Storage Root 优先级：

1. `REFLECTA_CONTENT_STORAGE_ROOT`：显式指定内容数据目录。
2. `reflecta-config.json` 中的 `contentStorageRoot`。
3. profile 对应的默认内容数据目录。

CLI / Drizzle Database Path 优先级：

1. `REFLECTA_DB_PATH`：显式指定 DB 文件。
2. `reflecta-config.json` 中的 `contentStorageRoot` + `reflecta.db`。
3. profile 对应的默认内容数据目录 + `reflecta.db`。

`REFLECTA_PROFILE` 只选择 `dev` 或 `prod` 默认路径和 migration 行为。Electron 开发态默认为 `dev`，打包态默认为 `prod`；CLI 默认为 `prod`。

## Runtime 初始化

数据库入口是 `createDBInstance(dbPath, { runMigrations })`。

```mermaid
flowchart TD
  A["App / CLI 启动"] --> B["解析 profile 与 Database Path"]
  B --> C["createDBInstance"]
  C --> D{"profile 是 prod?"}
  D -->|是| E["performDbMigration"]
  D -->|否| F["跳过 migration"]
  E --> G["业务服务使用 DB"]
  F --> G
```

prod 启动时会读取 `packages/server/src/db/migration/sql/vX.Y.Z.sql`，按语义版本顺序执行 `<= app.version` 且尚未记录在 `_migrations` 表里的 SQL。

dev 启动时不执行 migration。dev schema 由显式命令维护。

## Prod 迁移流程

prod migration 是用户数据安全路径：

1. 当前 `v1.0.0.sql` 是 base schema。
2. 同一个未发布 app version 内的 schema 变更维护在同一个 `vX.Y.Z.sql`。
3. app version 一旦发布，后续 schema 变更必须提升 app version 并新增对应 SQL 文件。
4. SQL 文件提交到 `packages/server/src/db/migration/sql`。
5. App 发布后，用户第一次启动新版 app 时自动执行未应用 migration。
6. 执行成功后写入 `_migrations`，避免重复执行。

prod 不依赖用户手动运行命令，也不要求用户安装开发工具。

## Dev 迁移流程

dev 追求改 schema 快，不保留开发数据。

常规流程：

```bash
bun run db:reset:dev
bun run db:push:dev
bun run db:seed:dev
bun run dev:gui
```

命令含义：

- `db:reset:dev`：删除 dev DB。
- `db:push:dev`：用 `packages/server/src/db/schema.ts` 同步 dev DB。
- `db:seed:dev`：写入测试数据并补齐 FTS 表。
- `dev:gui`：使用 dev profile 启动 Electron。

`db:push:dev` 只用于开发库，不作为 prod 升级机制。

## FTS 表

Drizzle schema 只描述普通业务表。SQLite FTS5 虚拟表由 SQL 负责创建：

- prod：通过 `v1.0.0.sql` 创建。
- dev：`db:push:dev` / `db:seed:dev` 会补齐 `fts_thoughts` 和 `fts_contexts`。

业务写入时由 service 层维护 FTS 数据。

## 发布检查

改动 schema 时，至少确认：

```bash
bun run db:reset:dev
bun run db:push:dev
bun run db:seed:dev
bun run typecheck
bun run lint
bun run fmt:check
```

如果 schema 变更要进入 prod，还必须新增或更新对应 app version 的 SQL migration。只改 `schema.ts` 不会升级用户数据库。
