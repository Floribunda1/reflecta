DROP TABLE IF EXISTS agent_runs;
DROP TABLE IF EXISTS agent_tool_invocations;
DROP TABLE IF EXISTS agent_messages;
DROP TABLE IF EXISTS agent_threads;

ALTER TABLE categories RENAME TO domains;
ALTER TABLE thoughts RENAME TO understandings;
ALTER TABLE thought_categories RENAME TO understanding_domains;
ALTER TABLE understanding_domains RENAME COLUMN thought_id TO understanding_id;
ALTER TABLE understanding_domains RENAME COLUMN category_id TO domain_id;
ALTER TABLE thought_connections RENAME TO understanding_connections;
ALTER TABLE contexts RENAME COLUMN thought_id TO understanding_id;
ALTER TABLE contexts RENAME COLUMN source_type TO medium;
ALTER TABLE contexts RENAME COLUMN source_name TO title;

DROP INDEX IF EXISTS idx_categories_parent;
DROP INDEX IF EXISTS idx_thoughts_created_at;
DROP INDEX IF EXISTS idx_thoughts_updated_at;
DROP INDEX IF EXISTS idx_tc_category;
DROP INDEX IF EXISTS idx_contexts_thought;
DROP INDEX IF EXISTS idx_contexts_source_type;
DROP INDEX IF EXISTS idx_conn_target;

CREATE INDEX IF NOT EXISTS idx_domains_parent ON domains(parent_id);
CREATE INDEX IF NOT EXISTS idx_understandings_created_at ON understandings(created_at);
CREATE INDEX IF NOT EXISTS idx_understandings_updated_at ON understandings(updated_at);
CREATE INDEX IF NOT EXISTS idx_ud_domain ON understanding_domains(domain_id);
CREATE INDEX IF NOT EXISTS idx_contexts_understanding ON contexts(understanding_id);
CREATE INDEX IF NOT EXISTS idx_contexts_medium ON contexts(medium);
CREATE INDEX IF NOT EXISTS idx_conn_target ON understanding_connections(target_id);

DROP TABLE IF EXISTS fts_thoughts;
DROP TABLE IF EXISTS fts_understandings;
DROP TABLE IF EXISTS fts_contexts;
