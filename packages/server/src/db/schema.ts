import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const domains = sqliteTable(
  "domains",
  {
    id: text("id").notNull().primaryKey(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => domains.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_domains_parent").on(t.parentId)],
);

export const understandings = sqliteTable(
  "understandings",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title"),
    body: text("body").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("idx_understandings_created_at").on(t.createdAt),
    index("idx_understandings_updated_at").on(t.updatedAt),
  ],
);

export const understandingDomains = sqliteTable(
  "understanding_domains",
  {
    understandingId: text("understanding_id")
      .notNull()
      .references(() => understandings.id, { onDelete: "cascade" }),
    domainId: text("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.understandingId, t.domainId] }),
    index("idx_ud_domain").on(t.domainId),
  ],
);

export const understandingConnections = sqliteTable(
  "understanding_connections",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => understandings.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => understandings.id, { onDelete: "cascade" }),
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
    understandingId: text("understanding_id")
      .notNull()
      .references(() => understandings.id, { onDelete: "cascade" }),
    medium: text("medium").notNull(),
    title: text("title"),
    content: text("content").notNull().default(""),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("idx_contexts_understanding").on(t.understandingId),
    index("idx_contexts_medium").on(t.medium),
  ],
);

export const migrations = sqliteTable("_migrations", {
  name: text("name").notNull().primaryKey(),
  runAt: text("run_at").notNull(),
});
