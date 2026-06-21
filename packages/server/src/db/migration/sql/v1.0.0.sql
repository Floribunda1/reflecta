CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

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

CREATE TABLE IF NOT EXISTS agent_threads (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT '新对话',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_threads_updated_at ON agent_threads(updated_at);

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  parts_json TEXT NOT NULL,
  attachments_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_thread ON agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_thread_seq ON agent_messages(thread_id, seq);

CREATE TABLE IF NOT EXISTS agent_tool_invocations (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES agent_messages(id) ON DELETE SET NULL,
  tool_call_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  state TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  error_text TEXT,
  approval_status TEXT NOT NULL DEFAULT 'not_required',
  result_ref_type TEXT,
  result_ref_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_tool_invocations_call ON agent_tool_invocations(tool_call_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_invocations_thread ON agent_tool_invocations(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_invocations_approval ON agent_tool_invocations(approval_status);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  model TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_thread ON agent_runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

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
