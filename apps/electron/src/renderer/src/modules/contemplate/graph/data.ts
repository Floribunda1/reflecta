import type { ThoughtSummaryDTO } from "@shared/thought";
import type { Category } from "@shared/category";
import type { GraphStatusFilter } from "../context";
import type { GraphColors } from "./colors";

export interface G6NodeData {
  id: string;
  combo?: string | null;
  data: {
    kind: "note";
    title: string;
    body: string;
    contextCount: number;
    connectionCount: number;
    hasContext: boolean;
    categoryId: string | null;
    categoryLabel: string;
    noteCount: number;
    primaryCategoryId: string | null;
    layoutGroupId: string;
    layoutGroupSize: number;
  };
  style: {
    size: number;
    fill: string;
    stroke: string;
    labelText: string;
    x?: number;
    y?: number;
    lineWidth?: number;
    opacity?: number;
  };
}

export interface G6ComboData {
  id: string;
  data: {
    kind: "domain";
    title: string;
    categoryId: string | null;
    categoryLabel: string;
    noteCount: number;
  };
  style: {
    fill: string;
    stroke: string;
    labelText: string;
    lineWidth?: number;
    opacity?: number;
    padding?: number;
  };
}

export interface G6EdgeData {
  id: string;
  source: string;
  target: string;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface G6Data {
  nodes: G6NodeData[];
  edges: G6EdgeData[];
  combos: G6ComboData[];
}

type VisibleGraphFacts = {
  edges: G6EdgeData[];
  connectedIdsByThoughtId: Map<string, Set<string>>;
  componentIdsByThoughtId: Map<string, string>;
};

function buildVisibleGraphFacts(items: ThoughtSummaryDTO[]): VisibleGraphFacts {
  const nodeIds = new Set(items.map((thought) => thought.id));
  const parent = new Map(items.map((thought) => [thought.id, thought.id]));
  const connectedIdsByThoughtId = new Map<string, Set<string>>();
  const seenConns = new Set<string>();
  const edges: G6EdgeData[] = [];

  const find = (id: string): string => {
    const current = parent.get(id);
    if (!current || current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const thought of items) {
    connectedIdsByThoughtId.set(thought.id, new Set());
  }

  for (const thought of items) {
    for (const targetId of thought.connectionIds) {
      if (targetId === thought.id) continue;
      if (!nodeIds.has(targetId)) continue;

      const key = `${thought.id}->${targetId}`;
      if (seenConns.has(key)) continue;

      seenConns.add(key);
      union(thought.id, targetId);
      edges.push({ id: key, source: thought.id, target: targetId });
      connectedIdsByThoughtId.get(thought.id)?.add(targetId);
      connectedIdsByThoughtId.get(targetId)?.add(thought.id);
    }
  }

  const componentIdsByThoughtId = new Map<string, string>();
  for (const thought of items) {
    componentIdsByThoughtId.set(thought.id, find(thought.id));
  }

  return { edges, connectedIdsByThoughtId, componentIdsByThoughtId };
}

function getNodeStyle(thought: ThoughtSummaryDTO, colors: GraphColors) {
  const hasContext = thought.contextCount > 0;

  return {
    fill: hasContext ? colors.nodeFill : colors.noContextFill,
    stroke: hasContext ? colors.nodeStroke : colors.noContextStroke,
  };
}

/** Builds G6-compatible graph data from visible thoughts and confirmed connections. */
export function buildG6Data(
  items: ThoughtSummaryDTO[],
  colors: GraphColors,
  categories: Category[] = [],
): G6Data {
  if (!items.length) return { nodes: [], edges: [], combos: [] };

  const { edges, connectedIdsByThoughtId, componentIdsByThoughtId } = buildVisibleGraphFacts(items);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const layoutGroupSizes = new Map<string, number>();
  const notesByCategory = new Map<string, ThoughtSummaryDTO[]>();
  const getLayoutGroupId = (thought: ThoughtSummaryDTO, connectionCount: number) => {
    if (connectionCount > 0) {
      return `component:${componentIdsByThoughtId.get(thought.id) ?? thought.id}`;
    }
    return `category:${thought.categoryIds[0] ?? "uncategorized"}`;
  };

  for (const thought of items) {
    const connectionCount = connectedIdsByThoughtId.get(thought.id)?.size ?? 0;
    const layoutGroupId = getLayoutGroupId(thought, connectionCount);
    layoutGroupSizes.set(layoutGroupId, (layoutGroupSizes.get(layoutGroupId) ?? 0) + 1);
    const categoryKey = thought.categoryIds[0] ?? "uncategorized";
    notesByCategory.set(categoryKey, [...(notesByCategory.get(categoryKey) ?? []), thought]);
  }

  const combos: G6ComboData[] = [...notesByCategory.entries()].map(([categoryKey, list]) => {
    const categoryId = categoryKey === "uncategorized" ? null : categoryKey;
    const categoryLabel = categoryId
      ? (categoryById.get(categoryId)?.name ?? "未命名 Category")
      : "未归类";
    return {
      id: `domain:${categoryKey}`,
      data: {
        kind: "domain",
        title: categoryLabel,
        categoryId,
        categoryLabel,
        noteCount: list.length,
      },
      style: {
        fill: colors.domainFill,
        stroke: colors.domainStroke,
        labelText: `${categoryLabel} · ${list.length}`,
        lineWidth: 1.4,
        opacity: 0.8,
        padding: 18,
      },
    };
  });

  const noteNodes: G6NodeData[] = items.map((t) => {
    const connectionCount = connectedIdsByThoughtId.get(t.id)?.size ?? 0;
    const hasContext = t.contextCount > 0;
    const nodeStyle = getNodeStyle(t, colors);
    const layoutGroupId = getLayoutGroupId(t, connectionCount);
    const categoryId = t.categoryIds[0] ?? null;
    const categoryLabel = categoryId
      ? (categoryById.get(categoryId)?.name ?? "未命名 Category")
      : "未归类";

    return {
      id: t.id,
      combo: `domain:${categoryId ?? "uncategorized"}`,
      data: {
        kind: "note",
        title: t.title ?? "",
        body: t.body ?? "",
        contextCount: t.contextCount,
        connectionCount,
        hasContext,
        categoryId,
        categoryLabel,
        noteCount: 1,
        primaryCategoryId: t.categoryIds[0] ?? null,
        layoutGroupId,
        layoutGroupSize: layoutGroupSizes.get(layoutGroupId) ?? 1,
      },
      style: {
        size: 32,
        fill: nodeStyle.fill,
        stroke: nodeStyle.stroke,
        labelText: truncateLabel(t.title || t.body || "", 18),
      },
    };
  });

  const domainEdges = buildDomainEdges(items, edges, colors);

  return { nodes: noteNodes, edges: [...domainEdges, ...edges], combos };
}

function buildDomainEdges(
  items: ThoughtSummaryDTO[],
  noteEdges: G6EdgeData[],
  colors: GraphColors,
): G6EdgeData[] {
  const categoryByThoughtId = new Map(
    items.map((thought) => [thought.id, thought.categoryIds[0] ?? "uncategorized"]),
  );
  const counts = new Map<string, { source: string; target: string; count: number }>();

  for (const edge of noteEdges) {
    const sourceCategory = categoryByThoughtId.get(edge.source);
    const targetCategory = categoryByThoughtId.get(edge.target);
    if (!sourceCategory || !targetCategory || sourceCategory === targetCategory) continue;
    const [source, target] = [`domain:${sourceCategory}`, `domain:${targetCategory}`].sort();
    const key = `${source}->${target}`;
    const current = counts.get(key) ?? { source, target, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }

  return [...counts.entries()].map(([id, edge]) => ({
    id: `domain-link:${id}`,
    source: edge.source,
    target: edge.target,
    style: {
      stroke: colors.domainStroke,
      lineWidth: Math.min(4, 1.25 + edge.count * 0.5),
      opacity: Math.min(0.72, 0.28 + edge.count * 0.12),
      endArrow: false,
    },
  }));
}

export function filterThoughtsByStatus(
  items: ThoughtSummaryDTO[],
  statusFilter: GraphStatusFilter,
): ThoughtSummaryDTO[] {
  if (statusFilter === "all" || items.length === 0) return items;

  return items.filter((thought) => {
    switch (statusFilter) {
      case "with-context":
        return thought.contextCount > 0;
      case "without-context":
        return thought.contextCount === 0;
    }
  });
}

function truncateLabel(text: string, max = 12): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
