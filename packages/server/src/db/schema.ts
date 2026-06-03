import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    type: text("type").notNull(),
    title: text("title"),
    body: text("body").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("idx_thoughts_type").on(t.type),
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

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title").notNull().default("新对话"),
    piSessionId: text("pi_session_id"),
    piSessionFile: text("pi_session_file"),
    lastMessagePreview: text("last_message_preview"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_conversations_updated_at").on(t.updatedAt)],
);
