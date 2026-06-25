# 数据迁移技术方案

Reflecta 使用两套策略处理数据库结构变化：

- **prod**：通过 app version 对应的 SQL migration 自动升级用户数据库。
- **dev**：通过 Drizzle schema push 重建开发库，方便频繁改 schema。

这两套流程共享同一份业务 schema，但运行时行为不同。

## 路径模型

Reflecta 区分三种路径概念：

| 概念                 | 含义                                                                 | 使用方                          |
| -------------------- | -------------------------------------------------------------------- | ------------------------------- |
| App Config Dir       | 应用自有状态目录，包含 `reflecta-config.json`、logs、retrieval index | Electron / CLI 读取配置与缓存   |
| Content Storage Root | 用户内容数据目录，包含 `reflecta.db`、`Sessions/`、`assets/`         | Electron / CLI 产品入口         |
| Database Path        | SQLite 文件路径，通常是 `<contentStorageRoot>/reflecta.db`           | DB-only CLI / Drizzle / scripts |

Runtime path 由三条轴解析：

```txt
Process Kind：electron | cli | test | script
Build Kind：release | source
Data Target：prod | dev | test
```

默认规则：

| 入口             | 默认 Data Target | 自动 migration |
| ---------------- | ---------------- | -------------- |
| Electron release | prod             | 是             |
| CLI release      | prod             | 是             |
| Electron source  | dev              | 否             |
| CLI source       | dev              | 否             |
| test             | test             | 仅测试初始化   |
| script           | 显式 dev/test    | 仅 dev/test    |

显式覆盖：

- CLI full-store：`--content-root <dir>`。
- CLI DB-only：`--db <path>`，不能用于 semantic search / retrieval / assets / agent。
- CLI config：`--app-config-dir <dir>`。
- Electron 测试启动：`--reflecta-content-root` / `--reflecta-app-config-dir` / `--reflecta-user-data-dir`。
- Drizzle：只接受 `dev-db.ts` 传入的 `REFLECTA_DB_PATH`。

`REFLECTA_PROFILE`、`.env.production.local`、`NODE_ENV=production` 不再决定数据目标或 migration 权限。

## Runtime 初始化

数据库入口是 `createDBInstance(dbPath, { runMigrations })`。

```mermaid
flowchart TD
  A["Electron / CLI 启动"] --> B["Runtime Resolver"]
  B --> C["解析 Content Storage Root 与 Database Path"]
  C --> D["createDBInstance"]
  D --> E{"runMigrations === true?"}
  E -->|是| F["performDbMigration"]
  E -->|否| G["跳过 migration"]
  F --> H["业务服务使用 DB"]
  G --> H
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
- `dev:gui`：源码态 Electron 默认使用 dev 数据目标。

`db:push:dev` 只用于开发库，不作为 prod 升级机制。

## FTS 表

Drizzle schema 只描述普通业务表。SQLite FTS5 虚拟表由 SQL 负责创建：

- prod：通过 `v1.0.0.sql` 创建。
- dev：`db:push:dev` / `db:seed:dev` 会补齐 `fts_understandings` 和 `fts_contexts`。

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
