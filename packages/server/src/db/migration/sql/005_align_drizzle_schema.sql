PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS fts_thoughts;
DROP TABLE IF EXISTS fts_contexts;

DROP INDEX IF EXISTS idx_categories_parent;
DROP INDEX IF EXISTS idx_thoughts_created_at;
DROP INDEX IF EXISTS idx_thoughts_updated_at;
DROP INDEX IF EXISTS idx_tc_category;
DROP INDEX IF EXISTS idx_conn_target;
DROP INDEX IF EXISTS idx_contexts_thought;
DROP INDEX IF EXISTS idx_contexts_source_type;
DROP INDEX IF EXISTS idx_conversations_updated_at;

DROP TABLE IF EXISTS __new_categories;
DROP TABLE IF EXISTS __new_thoughts;
DROP TABLE IF EXISTS __new_thought_categories;
DROP TABLE IF EXISTS __new_thought_connections;
DROP TABLE IF EXISTS __new_contexts;
DROP TABLE IF EXISTS __new_conversations;

CREATE TABLE __new_categories (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO __new_categories (id, name, parent_id, sort_order, created_at, updated_at)
SELECT id, name, parent_id, sort_order, created_at, updated_at FROM categories;

DROP TABLE categories;
ALTER TABLE __new_categories RENAME TO categories;
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE __new_thoughts (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

INSERT INTO __new_thoughts (id, title, body, created_at, updated_at, deleted_at)
SELECT id, title, body, created_at, updated_at, deleted_at FROM thoughts;

DROP TABLE thoughts;
ALTER TABLE __new_thoughts RENAME TO thoughts;
CREATE INDEX idx_thoughts_created_at ON thoughts(created_at);
CREATE INDEX idx_thoughts_updated_at ON thoughts(updated_at);

CREATE TABLE __new_thought_categories (
  thought_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (thought_id, category_id)
);

INSERT INTO __new_thought_categories (thought_id, category_id)
SELECT thought_id, category_id FROM thought_categories;

DROP TABLE thought_categories;
ALTER TABLE __new_thought_categories RENAME TO thought_categories;
CREATE INDEX idx_tc_category ON thought_categories(category_id);

CREATE TABLE __new_thought_connections (
  source_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, target_id)
);

INSERT INTO __new_thought_connections (source_id, target_id)
SELECT source_id, target_id FROM thought_connections;

DROP TABLE thought_connections;
ALTER TABLE __new_thought_connections RENAME TO thought_connections;
CREATE INDEX idx_conn_target ON thought_connections(target_id);

CREATE TABLE __new_contexts (
  id TEXT NOT NULL PRIMARY KEY,
  thought_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_name TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

INSERT INTO __new_contexts (id, thought_id, source_type, source_name, content, created_at, deleted_at)
SELECT id, thought_id, source_type, source_name, content, created_at, deleted_at FROM contexts;

DROP TABLE contexts;
ALTER TABLE __new_contexts RENAME TO contexts;
CREATE INDEX idx_contexts_thought ON contexts(thought_id);
CREATE INDEX idx_contexts_source_type ON contexts(source_type);

CREATE TABLE __new_conversations (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '新对话',
  pi_session_id TEXT,
  pi_session_file TEXT,
  last_message_preview TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO __new_conversations (
  id,
  title,
  pi_session_id,
  pi_session_file,
  last_message_preview,
  created_at,
  updated_at
)
SELECT
  id,
  coalesce(title, '新对话'),
  pi_session_id,
  pi_session_file,
  last_message_preview,
  created_at,
  updated_at
FROM conversations;

DROP TABLE conversations;
ALTER TABLE __new_conversations RENAME TO conversations;
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);

PRAGMA foreign_keys=ON;

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
WHERE deleted_at IS NULL;

INSERT INTO fts_contexts (context_id, thought_id, source_name, content)
SELECT id, thought_id, source_name, content
FROM contexts
WHERE deleted_at IS NULL;
