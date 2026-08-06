/**
 * 数据迁移 v1.1.0
 *
 * 全系统数据版本 v1.1.0 的迁移逻辑。
 * SQLite 部分通过 ctx.sql 执行；如需重建向量库/迁移 session，在此声明或由 Electron 按版本执行。
 * name 保留 ".sql" 后缀以兼容历史 _migrations 记录。
 */
import type { MigrationContext } from "../../migration";

export default {
  name: "v1.1.0.sql",
  version: [1, 1, 0],
  up: (ctx: MigrationContext) => {
    ctx.sql(
      "DROP TABLE IF EXISTS agent_runs;\nDROP TABLE IF EXISTS agent_tool_invocations;\nDROP TABLE IF EXISTS agent_messages;\nDROP TABLE IF EXISTS agent_threads;\n\nALTER TABLE categories RENAME TO domains;\nALTER TABLE thoughts RENAME TO understandings;\nALTER TABLE thought_categories RENAME TO understanding_domains;\nALTER TABLE understanding_domains RENAME COLUMN thought_id TO understanding_id;\nALTER TABLE understanding_domains RENAME COLUMN category_id TO domain_id;\nALTER TABLE thought_connections RENAME TO understanding_connections;\nALTER TABLE contexts RENAME COLUMN thought_id TO understanding_id;\nALTER TABLE contexts RENAME COLUMN source_type TO medium;\nALTER TABLE contexts RENAME COLUMN source_name TO title;\n\nDROP INDEX IF EXISTS idx_categories_parent;\nDROP INDEX IF EXISTS idx_thoughts_created_at;\nDROP INDEX IF EXISTS idx_thoughts_updated_at;\nDROP INDEX IF EXISTS idx_tc_category;\nDROP INDEX IF EXISTS idx_contexts_thought;\nDROP INDEX IF EXISTS idx_contexts_source_type;\nDROP INDEX IF EXISTS idx_conn_target;\n\nCREATE INDEX IF NOT EXISTS idx_domains_parent ON domains(parent_id);\nCREATE INDEX IF NOT EXISTS idx_understandings_created_at ON understandings(created_at);\nCREATE INDEX IF NOT EXISTS idx_understandings_updated_at ON understandings(updated_at);\nCREATE INDEX IF NOT EXISTS idx_ud_domain ON understanding_domains(domain_id);\nCREATE INDEX IF NOT EXISTS idx_contexts_understanding ON contexts(understanding_id);\nCREATE INDEX IF NOT EXISTS idx_contexts_medium ON contexts(medium);\nCREATE INDEX IF NOT EXISTS idx_conn_target ON understanding_connections(target_id);\n\nDROP TABLE IF EXISTS fts_thoughts;\nDROP TABLE IF EXISTS fts_understandings;\nDROP TABLE IF EXISTS fts_contexts;\n",
    );
  },
};
