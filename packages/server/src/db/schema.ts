import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const understandingMentions = sqliteTable(
  "understanding_mentions",
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
    index("idx_mentions_target").on(t.targetId),
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

export const understandingCanvases = sqliteTable(
  "understanding_canvases",
  {
    id: text("id").notNull().primaryKey(),
    title: text("title").notNull(),
    viewport: text("viewport"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("idx_canvases_updated_at").on(t.updatedAt)],
);

export const understandingCanvasElements = sqliteTable(
  "understanding_canvas_elements",
  {
    id: text("id").notNull().primaryKey(),
    canvasId: text("canvas_id")
      .notNull()
      .references(() => understandingCanvases.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    understandingId: text("understanding_id").references(() => understandings.id, {
      onDelete: "set null",
    }),
    canvasRefId: text("canvas_ref_id").references(() => understandingCanvases.id, {
      onDelete: "set null",
    }),
    props: text("props").notNull().default("{}"),
    parentId: text("parent_id").references((): AnySQLiteColumn => understandingCanvasElements.id, {
      onDelete: "set null",
    }),
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    zIndex: integer("z_index").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_canvas_elements_canvas").on(t.canvasId),
    index("idx_canvas_elements_understanding").on(t.understandingId),
    index("idx_canvas_elements_parent").on(t.parentId),
  ],
);

export const understandingCanvasEdges = sqliteTable(
  "understanding_canvas_edges",
  {
    id: text("id").notNull().primaryKey(),
    canvasId: text("canvas_id")
      .notNull()
      .references(() => understandingCanvases.id, { onDelete: "cascade" }),
    sourceElementId: text("source_element_id")
      .notNull()
      .references(() => understandingCanvasElements.id, { onDelete: "cascade" }),
    sourcePortId: text("source_port_id").notNull(),
    targetElementId: text("target_element_id")
      .notNull()
      .references(() => understandingCanvasElements.id, { onDelete: "cascade" }),
    targetPortId: text("target_port_id").notNull(),
    router: text("router"),
    connector: text("connector").notNull(),
    label: text("label"),
    attrs: text("attrs").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_canvas_edges_canvas").on(t.canvasId),
    index("idx_canvas_edges_source").on(t.sourceElementId),
    index("idx_canvas_edges_target").on(t.targetElementId),
  ],
);
