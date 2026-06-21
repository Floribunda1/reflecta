import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").notNull().primaryKey(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => categories.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_categories_parent").on(t.parentId)],
);

export const thoughts = sqliteTable(
  "thoughts",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title"),
    body: text("body").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("idx_thoughts_created_at").on(t.createdAt),
    index("idx_thoughts_updated_at").on(t.updatedAt),
  ],
);

export const thoughtCategories = sqliteTable(
  "thought_categories",
  {
    thoughtId: text("thought_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.thoughtId, t.categoryId] }),
    index("idx_tc_category").on(t.categoryId),
  ],
);

export const thoughtConnections = sqliteTable(
  "thought_connections",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.targetId] }),
    index("idx_conn_target").on(t.targetId),
  ],
);

export const contexts = sqliteTable(
  "contexts",
  {
    id: text("id").notNull().primaryKey(),
    thoughtId: text("thought_id")
      .notNull()
      .references(() => thoughts.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceName: text("source_name"),
    content: text("content").notNull().default(""),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("idx_contexts_thought").on(t.thoughtId),
    index("idx_contexts_source_type").on(t.sourceType),
  ],
);

export const agentThreads = sqliteTable(
  "agent_threads",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title").notNull().default("新对话"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_agent_threads_updated_at").on(t.updatedAt)],
);

export const agentMessages = sqliteTable(
  "agent_messages",
  {
    id: text("id").notNull().primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: text("role").notNull(),
    partsJson: text("parts_json").notNull(),
    attachmentsJson: text("attachments_json"),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_agent_messages_thread").on(t.threadId),
    index("idx_agent_messages_thread_seq").on(t.threadId, t.seq),
  ],
);

export const agentToolInvocations = sqliteTable(
  "agent_tool_invocations",
  {
    id: text("id").notNull().primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => agentMessages.id, { onDelete: "set null" }),
    toolCallId: text("tool_call_id").notNull(),
    toolName: text("tool_name").notNull(),
    state: text("state").notNull(),
    inputJson: text("input_json"),
    outputJson: text("output_json"),
    errorText: text("error_text"),
    approvalStatus: text("approval_status").notNull().default("not_required"),
    resultRefType: text("result_ref_type"),
    resultRefId: text("result_ref_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_agent_tool_invocations_call").on(t.toolCallId),
    index("idx_agent_tool_invocations_thread").on(t.threadId),
    index("idx_agent_tool_invocations_approval").on(t.approvalStatus),
  ],
);

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").notNull().primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    model: text("model"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    errorText: text("error_text"),
  },
  (t) => [
    index("idx_agent_runs_thread").on(t.threadId),
    index("idx_agent_runs_status").on(t.status),
  ],
);

export const migrations = sqliteTable("_migrations", {
  name: text("name").notNull().primaryKey(),
  runAt: text("run_at").notNull(),
});
