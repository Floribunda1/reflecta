CREATE TABLE conversations (
  id              TEXT PRIMARY KEY NOT NULL,
  title           TEXT NOT NULL DEFAULT '新对话',
  pi_session_id   TEXT,
  pi_session_file TEXT,
  last_message_preview TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
