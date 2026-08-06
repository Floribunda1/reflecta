# 数据迁移技术方案

Reflecta 使用**统一的 code migration** 管理整个系统的数据版本，Electron 是唯一的迁移执行者，CLI 只做数据版本校验。

## 核心概念：全系统数据版本

**一个版本号代表整个系统的数据版本**，不只是 SQLite schema：

```
版本 1.4.0 表示：
  ├─ SQLite 数据版本 = 1.4.0
  ├─ 向量数据库（LanceDB）数据版本 = 1.4.0
  └─ session 数据版本 = 1.4.0
```

版本号记录在 SQLite（`_migrations` 表的最大已执行迁移），是**单一事实来源**。

## 迁移机制：code migration

迁移 = 按版本顺序的 code migration 列表，**每个版本一个迁移单元**：

```ts
// migration/code/v1.4.0.ts
export default {
  name: "v1.4.0",
  version: [1, 4, 0],
  up: async (ctx) => {
    ctx.sql(`...`);            // SQLite 迁移逻辑（可选）
    // ... 任意数据迁移逻辑（session、数据改写等）
  },
};
```

- **唯一形态是 code migration**（不再区分 SQL 文件 / code 两套；历史 SQL 迁移已改写为 code migration，name 保留 `.sql` 后缀兼容已执行记录）；
- `up(ctx)` 可执行任意数据迁移：`ctx.sql()` 执行 SQLite 逻辑、`ctx.db` 直接操作数据、处理 session 文件等；
- 执行成功的迁移写入 `_migrations`，避免重复执行。

代码位置：`packages/server/src/db/migration.ts`（机制）+ `migration/code/*.ts`（各版本迁移）。

## 执行者：Electron 唯一

**只有 Electron 执行数据迁移**（升级后自动迁移 SQLite、向量库、session）：

```ts
// Electron 启动时序
app.whenReady().then(async () => {
  const { executed } = await initializeDB();
  // initializeDB 内：createDBInstance(runMigrations: false)
  //                + 显式 performDbMigration(db, appVersion) → 返回本次执行的迁移
  if (needsVectorRebuild(executed)) {
    await retrievalIndexCoordinator.rebuild();   // 数据版本推进到 v1.4.0+，重建向量库
  } else {
    retrievalIndexCoordinator.start();           // 常规 reconcile
  }
});
```

**向量库 rebuild 的触发**：`performDbMigration` 返回本次执行的迁移列表（`executed`）；当包含 v1.4.0 及以上的迁移（投影逻辑变化）时，Electron 直接调用 `coordinator.rebuild()`。不是每次启动都 rebuild，只在数据版本推进到需要重建的版本时。

## CLI：只校验，不迁移

CLI 与 Electron 共享同一数据目录。为避免并发迁移，**CLI 永不执行迁移**，只做版本校验：

```ts
// CLI 启动
db = await createDBInstance(dbPath, { runMigrations: false });
if (runtime.migrationPolicy === "verify") {
  verifyDataVersion(db, packageJson.version);
  // 数据版本 < CLI 期望 → 抛错提示"请先打开 Reflecta 完成迁移"
}
```

- release CLI：`migrationPolicy = "verify"`——读数据版本（`_migrations` 最大版本），低于 CLI 期望版本时拒绝执行并提示；
- 未初始化的数据（无迁移记录）：提示先打开 Reflecta 初始化；
- dev（source）CLI：不校验（dev 库由 schema-push 维护）。

## Dev 迁移流程

dev 追求改 schema 快，不保留开发数据，仍走 Drizzle schema push：

```bash
bun run db:reset:dev
bun run db:push:dev
bun run db:seed:dev
bun run dev:gui
```

- `db:push:dev` 用 `packages/server/src/db/schema.ts` 同步 dev DB；
- 只用于开发库，不作为 prod 升级机制。

## 路径模型

| 概念                 | 含义                                                                 | 使用方                          |
| -------------------- | -------------------------------------------------------------------- | ------------------------------- |
| App Config Dir       | 应用自有状态目录，包含 `reflecta-config.json`、logs、retrieval index | Electron / CLI 读取配置与缓存   |
| Content Storage Root | 用户内容数据目录，包含 `reflecta.db`、`Sessions/`、`assets/`         | Electron / CLI 产品入口         |
| Database Path        | SQLite 文件路径，通常是 `<contentStorageRoot>/reflecta.db`           | DB-only CLI / Drizzle / scripts |

Runtime path 由三条轴解析：`Process Kind（electron | cli | test | script）` × `Build Kind（release | source）` × `Data Target（prod | dev | test）`。

## 发布检查

改动 schema 或检索投影时，至少确认：

```bash
bun run db:reset:dev
bun run db:push:dev
bun run db:seed:dev
bun run typecheck
bun run lint
bun run fmt:check
```

- schema 变更要进入 prod：新增对应 app version 的 code migration（`migration/code/vX.Y.Z.ts`）；
- 检索投影变化（索引文本构造）：在对应版本的迁移中处理，并确保该版本会被 `needsVectorRebuild` 覆盖（阈值 `v1.4.0`，见 Electron 启动逻辑）；
- 只改 `schema.ts` 不会升级用户数据库。
