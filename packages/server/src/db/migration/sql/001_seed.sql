CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type);
CREATE INDEX IF NOT EXISTS idx_thoughts_created_at ON thoughts(created_at);
CREATE INDEX IF NOT EXISTS idx_thoughts_updated_at ON thoughts(updated_at);

CREATE TABLE IF NOT EXISTS thought_categories (
  thought_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (thought_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_tc_category ON thought_categories(category_id);

CREATE TABLE IF NOT EXISTS thought_connections (
  source_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_conn_target ON thought_connections(target_id);

CREATE TABLE IF NOT EXISTS contexts (
  id TEXT PRIMARY KEY NOT NULL,
  thought_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_name TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_contexts_thought ON contexts(thought_id);
CREATE INDEX IF NOT EXISTS idx_contexts_source_type ON contexts(source_type);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_thoughts USING fts5(
  thought_id UNINDEXED,
  title,
  body
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_contexts USING fts5(
  context_id UNINDEXED,
  thought_id UNINDEXED,
  source_name,
  content
);

INSERT INTO fts_thoughts (thought_id, title, body)
SELECT id, coalesce(title, ''), body
FROM thoughts
WHERE deleted_at IS NULL
  AND id NOT IN (SELECT thought_id FROM fts_thoughts);

INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
SELECT id, thought_id, source_name, content
FROM contexts
WHERE deleted_at IS NULL
  AND id NOT IN (SELECT context_id FROM fts_contexts);
