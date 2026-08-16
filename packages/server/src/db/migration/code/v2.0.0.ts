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
        "CREATE INDEX IF NOT EXISTS idx_mentions_target ON understanding_mentions(target_id);\n" +
        "CREATE TABLE IF NOT EXISTS understanding_canvases (\n" +
        "  id TEXT PRIMARY KEY NOT NULL,\n" +
        "  title TEXT NOT NULL,\n" +
        "  description TEXT,\n" +
        "  viewport TEXT,\n" +
        "  created_at TEXT NOT NULL,\n" +
        "  updated_at TEXT NOT NULL\n" +
        ");\n" +
        "CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON understanding_canvases(updated_at);\n" +
        "CREATE TABLE IF NOT EXISTS understanding_canvas_elements (\n" +
        "  id TEXT PRIMARY KEY NOT NULL,\n" +
        "  canvas_id TEXT NOT NULL REFERENCES understanding_canvases(id) ON DELETE CASCADE,\n" +
        "  kind TEXT NOT NULL,\n" +
        "  understanding_id TEXT REFERENCES understandings(id) ON DELETE SET NULL,\n" +
        "  canvas_ref_id TEXT REFERENCES understanding_canvases(id) ON DELETE SET NULL,\n" +
        "  props TEXT NOT NULL DEFAULT '{}',\n" +
        "  parent_id TEXT REFERENCES understanding_canvas_elements(id) ON DELETE SET NULL,\n" +
        "  x REAL NOT NULL,\n" +
        "  y REAL NOT NULL,\n" +
        "  width REAL NOT NULL,\n" +
        "  height REAL NOT NULL,\n" +
        "  z_index INTEGER NOT NULL DEFAULT 0,\n" +
        "  created_at TEXT NOT NULL,\n" +
        "  updated_at TEXT NOT NULL\n" +
        ");\n" +
        "CREATE INDEX IF NOT EXISTS idx_canvas_elements_canvas ON understanding_canvas_elements(canvas_id);\n" +
        "CREATE INDEX IF NOT EXISTS idx_canvas_elements_understanding ON understanding_canvas_elements(understanding_id);\n" +
        "CREATE INDEX IF NOT EXISTS idx_canvas_elements_parent ON understanding_canvas_elements(parent_id);\n" +
        "CREATE TABLE IF NOT EXISTS understanding_canvas_edges (\n" +
        "  id TEXT PRIMARY KEY NOT NULL,\n" +
        "  canvas_id TEXT NOT NULL REFERENCES understanding_canvases(id) ON DELETE CASCADE,\n" +
        "  source_element_id TEXT NOT NULL REFERENCES understanding_canvas_elements(id) ON DELETE CASCADE,\n" +
        "  target_element_id TEXT NOT NULL REFERENCES understanding_canvas_elements(id) ON DELETE CASCADE,\n" +
        "  label TEXT,\n" +
        "  props TEXT NOT NULL DEFAULT '{}',\n" +
        "  created_at TEXT NOT NULL\n" +
        ");\n" +
        "CREATE INDEX IF NOT EXISTS idx_canvas_edges_canvas ON understanding_canvas_edges(canvas_id);\n" +
        "CREATE INDEX IF NOT EXISTS idx_canvas_edges_source ON understanding_canvas_edges(source_element_id);\n" +
        "CREATE INDEX IF NOT EXISTS idx_canvas_edges_target ON understanding_canvas_edges(target_element_id);\n",
    );
  },
};

export default migration;
