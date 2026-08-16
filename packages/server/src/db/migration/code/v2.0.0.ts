/**
 * 数据迁移 v2.0.0
 *
 * TBD-3 wiki-link 降级：弱引用与结构关系彻底分离。
 * 表 `understanding_connections` → `understanding_mentions`（wiki-link 是引用/提及，不是结构关系）。
 * SQLite 的 ALTER TABLE RENAME 保留旧索引名，显式重建索引以对齐 schema.ts。
 * name 保留 ".sql" 后缀以兼容历史 _migrations 记录。
 */
import type { CodeMigration, MigrationContext } from "../../migration";

const migration: CodeMigration = {
  name: "v2.0.0.sql",
  version: [2, 0, 0],
  up: (ctx: MigrationContext) => {
    ctx.sql(
      "ALTER TABLE understanding_connections RENAME TO understanding_mentions;\n" +
        "DROP INDEX IF EXISTS idx_conn_target;\n" +
        "CREATE INDEX IF NOT EXISTS idx_mentions_target ON understanding_mentions(target_id);\n",
    );
  },
};

export default migration;
