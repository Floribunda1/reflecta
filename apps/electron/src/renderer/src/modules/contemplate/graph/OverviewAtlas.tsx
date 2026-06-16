import { useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { Category } from "@shared/category";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { cn } from "@renderer/lib/utils";

type AtlasNode = {
  id: string;
  categoryId: string | null;
  label: string;
  breadcrumb: string;
  count: number;
  ownCount: number;
  children: AtlasNode[];
};

type DomainNodeData = {
  node: AtlasNode;
  maxCount: number;
  relatedCount: number;
  dimmed: boolean;
  selectable: boolean;
};

type DomainFlowNode = Node<DomainNodeData, "domain">;

const NODE_W = 240;
const NODE_H = 92;
const X_GAP = 92;
const Y_GAP = 36;
const TREE_GAP_X = 140;
const TREE_GAP_Y = 96;

function buildAtlas(categories: Category[], thoughts: ThoughtSummaryDTO[]): AtlasNode[] {
  const nodes = new Map<string, AtlasNode>();
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const roots: AtlasNode[] = [];

  for (const category of categories) {
    nodes.set(category.id, {
      id: category.id,
      categoryId: category.id,
      label: category.name,
      breadcrumb: category.name,
      count: 0,
      ownCount: 0,
      children: [],
    });
  }

  for (const category of categories) {
    const node = nodes.get(category.id)!;
    const parent = category.parentId ? nodes.get(category.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const uncategorized: AtlasNode = {
    id: "uncategorized",
    categoryId: null,
    label: "未归类",
    breadcrumb: "未归类",
    count: 0,
    ownCount: 0,
    children: [],
  };

  for (const thought of thoughts) {
    const categoryId = thought.categoryIds[0];
    const node = categoryId ? nodes.get(categoryId) : null;
    if (node) node.ownCount += 1;
    else uncategorized.ownCount += 1;
  }

  const rollup = (node: AtlasNode): number => {
    const names: string[] = [];
    let current: AtlasNode | undefined = node;
    while (current) {
      names.unshift(current.label);
      const category = categoryById.get(current.id);
      current = category?.parentId ? nodes.get(category.parentId) : undefined;
    }
    node.breadcrumb = names.join(" / ");
    node.count = node.ownCount + node.children.reduce((sum, child) => sum + rollup(child), 0);
    node.children = node.children
      .filter((child) => child.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return node.count;
  };

  const result = roots
    .filter((node) => rollup(node) > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (uncategorized.ownCount > 0) {
    uncategorized.count = uncategorized.ownCount;
    result.push(uncategorized);
  }
  return result;
}

function subtreeSlots(node: AtlasNode): number {
  if (node.children.length === 0) return 1;
  return Math.max(
    1,
    node.children.reduce((sum, child) => sum + subtreeSlots(child), 0),
  );
}

function layoutTree(roots: AtlasNode[]) {
  const allNodes = roots.flatMap(flattenAtlas);
  const maxCount = Math.max(...allNodes.map((node) => node.count), 1);
  const treeLayouts = roots.map((root) => layoutSubtree(root, maxCount));
  const columnCount = Math.min(2, treeLayouts.length);
  const columnWidth = Math.max(...treeLayouts.map((layout) => layout.width), NODE_W) + TREE_GAP_X;
  const columnHeights = Array.from({ length: columnCount }, () => 0);
  const nodes: DomainFlowNode[] = [];
  const edges: Edge[] = [];

  for (const layout of treeLayouts) {
    const col = columnHeights.indexOf(Math.min(...columnHeights));
    const offsetX = col * columnWidth;
    const offsetY = columnHeights[col];
    nodes.push(
      ...layout.nodes.map((node) => ({
        ...node,
        position: { x: node.position.x + offsetX, y: node.position.y + offsetY },
      })),
    );
    edges.push(...layout.edges);
    columnHeights[col] += layout.height + TREE_GAP_Y;
  }

  return { nodes, edges };
}

function layoutSubtree(root: AtlasNode, maxCount: number) {
  const nodes: DomainFlowNode[] = [];
  const edges: Edge[] = [];

  const visit = (node: AtlasNode, depth: number, slotStart: number): number => {
    const slots = subtreeSlots(node);
    const centerSlot = slotStart + (slots - 1) / 2;
    nodes.push({
      id: node.id,
      type: "domain",
      position: { x: depth * (NODE_W + X_GAP), y: centerSlot * (NODE_H + Y_GAP) },
      data: {
        node,
        maxCount,
        relatedCount: 0,
        dimmed: false,
        selectable: Boolean(node.categoryId),
      },
    });

    let childSlot = slotStart;
    for (const child of node.children) {
      edges.push({
        id: `${node.id}->${child.id}`,
        source: node.id,
        target: child.id,
        type: "smoothstep",
        style: { stroke: "var(--border)", strokeWidth: 1.4 },
      });
      childSlot = visit(child, depth + 1, childSlot);
    }
    return slotStart + slots;
  };

  const slots = visit(root, 0, 0);
  const maxDepth = Math.max(...nodes.map((node) => node.position.x / (NODE_W + X_GAP)), 0);
  return {
    nodes,
    edges,
    width: (maxDepth + 1) * NODE_W + maxDepth * X_GAP,
    height: slots * NODE_H + Math.max(0, slots - 1) * Y_GAP,
  };
}

function flattenAtlas(node: AtlasNode): AtlasNode[] {
  return [node, ...node.children.flatMap(flattenAtlas)];
}

function buildDomainRelations(
  thoughts: ThoughtSummaryDTO[],
  visibleCategoryIds: Set<string>,
): Edge[] {
  const thoughtCategory = new Map<string, string>();
  for (const thought of thoughts) {
    const categoryId = thought.categoryIds[0];
    if (categoryId && visibleCategoryIds.has(categoryId))
      thoughtCategory.set(thought.id, categoryId);
  }

  const relationCounts = new Map<string, number>();
  for (const thought of thoughts) {
    const sourceCategory = thoughtCategory.get(thought.id);
    if (!sourceCategory) continue;
    for (const targetId of thought.connectionIds) {
      const targetCategory = thoughtCategory.get(targetId);
      if (!targetCategory || targetCategory === sourceCategory) continue;
      const [a, b] = [sourceCategory, targetCategory].sort();
      const key = `${a}->${b}`;
      relationCounts.set(key, (relationCounts.get(key) ?? 0) + 1);
    }
  }

  return [...relationCounts.entries()].map(([key, count]) => {
    const [source, target] = key.split("->");
    return {
      id: `domain:${key}`,
      source,
      target,
      type: "smoothstep",
      selectable: false,
      data: { count },
      style: {
        stroke: "var(--ring)",
        strokeWidth: Math.min(3, 1 + count * 0.35),
        opacity: 0.18,
        strokeDasharray: "5 6",
      },
    } satisfies Edge;
  });
}

function relatedIds(edges: Edge[], id: string | null) {
  if (!id) return new Set<string>();
  const ids = new Set([id]);
  for (const edge of edges) {
    if (edge.source === id) ids.add(edge.target);
    if (edge.target === id) ids.add(edge.source);
  }
  return ids;
}

function HiddenHandles() {
  return (
    <>
      <Handle className="opacity-0" type="target" position={Position.Left} />
      <Handle className="opacity-0" type="source" position={Position.Right} />
    </>
  );
}

function DomainNode({ data }: NodeProps<DomainFlowNode>) {
  const ratio = data.maxCount > 0 ? data.node.count / data.maxCount : 0;
  const countLabel =
    data.node.ownCount > 0 && data.node.ownCount !== data.node.count
      ? `${data.node.ownCount} / ${data.node.count}`
      : `${data.node.count}`;

  return (
    <button
      type="button"
      disabled={!data.selectable}
      className={cn(
        "w-[240px] rounded-md border border-border bg-card px-4 py-3 text-left text-card-foreground shadow-xs transition-colors",
        "hover:border-primary/50 hover:bg-accent disabled:pointer-events-none disabled:bg-muted/30 disabled:text-muted-foreground",
        data.relatedCount > 0 && "ring-1 ring-ring/20",
        data.dimmed && "opacity-35",
      )}
    >
      <HiddenHandles />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{data.node.label}</div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {data.node.breadcrumb}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {data.relatedCount > 0 && (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {data.relatedCount}
            </span>
          )}
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {countLabel}
          </span>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${Math.max(8, ratio * 100)}%` }}
        />
      </div>
    </button>
  );
}

const NODE_TYPES = { domain: DomainNode };

function miniMapNodeColor(node: DomainFlowNode) {
  return node.data.node.categoryId ? "var(--card)" : "var(--muted)";
}

export function OverviewAtlas({
  categories,
  thoughts,
  onSelectCategory,
}: {
  categories: Category[];
  thoughts: ThoughtSummaryDTO[];
  onSelectCategory: (categoryId: string) => void;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const atlas = buildAtlas(categories, thoughts);
  const { nodes: treeNodes, edges: treeEdges } = layoutTree(atlas);
  const visibleCategoryIds = new Set(
    treeNodes.flatMap((node) => (node.data.node.categoryId ? [node.data.node.categoryId] : [])),
  );
  const relationEdges = buildDomainRelations(thoughts, visibleCategoryIds);
  const related = relatedIds(relationEdges, hoveredNodeId);
  const relationCounts = new Map<string, number>();
  for (const edge of relationEdges) {
    const count = Number((edge.data as { count?: number } | undefined)?.count ?? 0);
    relationCounts.set(edge.source, (relationCounts.get(edge.source) ?? 0) + count);
    relationCounts.set(edge.target, (relationCounts.get(edge.target) ?? 0) + count);
  }
  const nodes = treeNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      relatedCount: relationCounts.get(node.id) ?? 0,
      dimmed: hoveredNodeId !== null && !related.has(node.id),
    },
  }));
  const edges = [
    ...relationEdges.map((edge) => {
      const active =
        hoveredNodeId !== null && (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
      return {
        ...edge,
        animated: active,
        style: {
          ...edge.style,
          opacity: active ? 0.78 : hoveredNodeId ? 0.06 : edge.style?.opacity,
          strokeWidth: active
            ? Math.max(Number(edge.style?.strokeWidth ?? 1), 2.4)
            : edge.style?.strokeWidth,
        },
      };
    }),
    ...treeEdges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity: hoveredNodeId && !related.has(edge.source) && !related.has(edge.target) ? 0.12 : 1,
      },
    })),
  ];

  return (
    <div className="absolute inset-0 bg-background">
      <ReactFlow
        colorMode="system"
        className="bg-background text-foreground"
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={(_, node) => {
          if (node.data.node.categoryId) onSelectCategory(node.data.node.categoryId);
        }}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        minZoom={0.24}
        maxZoom={1.6}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" gap={40} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={miniMapNodeColor}
          nodeStrokeColor="var(--border)"
          nodeBorderRadius={4}
          maskColor="color-mix(in srgb, var(--background), transparent 25%)"
          bgColor="var(--background)"
        />
      </ReactFlow>
    </div>
  );
}
