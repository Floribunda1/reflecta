import { useCallback, useMemo, useRef, type MouseEvent } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
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
  selectable: boolean;
};

type DomainFlowNode = Node<DomainNodeData, "domain">;

const NODE_W = 240;
const NODE_H = 92;
const X_GAP = 92;
const Y_GAP = 36;
const TREE_GAP_X = 140;
const TREE_GAP_Y = 96;

const TREE_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
  color: "var(--border)",
} as const;

const RELATION_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
  color: "var(--primary)",
} as const;

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
      width: NODE_W,
      height: NODE_H,
      data: {
        node,
        maxCount,
        relatedCount: 0,
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
        markerEnd: TREE_MARKER,
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
      className: "overview-relation-edge",
      markerEnd: RELATION_MARKER,
      selectable: false,
      data: { count },
      style: {
        stroke: "var(--primary)",
        strokeWidth: Math.min(3, 1 + count * 0.35),
        opacity: 0.18,
        strokeDasharray: "5 6",
      },
    } satisfies Edge;
  });
}

function buildRelationIndex(edges: Edge[]) {
  const relatedByNode = new Map<string, Set<string>>();
  const edgeIdsByNode = new Map<string, Set<string>>();
  for (const edge of edges) {
    const sourceRelated = relatedByNode.get(edge.source) ?? new Set([edge.source]);
    sourceRelated.add(edge.target);
    relatedByNode.set(edge.source, sourceRelated);

    const targetRelated = relatedByNode.get(edge.target) ?? new Set([edge.target]);
    targetRelated.add(edge.source);
    relatedByNode.set(edge.target, targetRelated);

    const sourceEdges = edgeIdsByNode.get(edge.source) ?? new Set<string>();
    sourceEdges.add(edge.id);
    edgeIdsByNode.set(edge.source, sourceEdges);

    const targetEdges = edgeIdsByNode.get(edge.target) ?? new Set<string>();
    targetEdges.add(edge.id);
    edgeIdsByNode.set(edge.target, targetEdges);
  }
  return { relatedByNode, edgeIdsByNode };
}

function clearHover(root: HTMLElement) {
  root.classList.remove("is-overview-hovering");
  root
    .querySelectorAll(".is-overview-related, .is-overview-dimmed, .is-overview-edge-active")
    .forEach((element) => {
      element.classList.remove(
        "is-overview-related",
        "is-overview-dimmed",
        "is-overview-edge-active",
      );
    });
}

function applyHover(
  root: HTMLElement,
  nodeId: string,
  relationIndex: ReturnType<typeof buildRelationIndex>,
) {
  clearHover(root);
  root.classList.add("is-overview-hovering");

  const related = relationIndex.relatedByNode.get(nodeId) ?? new Set([nodeId]);
  const activeEdgeIds = relationIndex.edgeIdsByNode.get(nodeId) ?? new Set<string>();

  root.querySelectorAll<HTMLElement>(".react-flow__node").forEach((element) => {
    const id = element.dataset.id;
    if (!id) return;
    element.classList.add(related.has(id) ? "is-overview-related" : "is-overview-dimmed");
  });

  root.querySelectorAll<HTMLElement>(".overview-relation-edge").forEach((element) => {
    const id = element.dataset.id;
    if (id && activeEdgeIds.has(id)) {
      element.classList.add("is-overview-edge-active");
    }
  });
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
        "overview-domain-card w-[240px] rounded-md border border-border bg-card px-4 py-3 text-left text-card-foreground shadow-xs transition-colors",
        "hover:border-primary/50 hover:bg-accent disabled:pointer-events-none disabled:bg-muted/30 disabled:text-muted-foreground",
        data.relatedCount > 0 && "ring-1 ring-ring/20",
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
  return node.data.node.categoryId ? "var(--primary)" : "var(--muted-foreground)";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const atlas = useMemo(() => buildAtlas(categories, thoughts), [categories, thoughts]);
  const { nodes: treeNodes, edges: treeEdges } = useMemo(() => layoutTree(atlas), [atlas]);
  const visibleCategoryIds = useMemo(
    () =>
      new Set(
        treeNodes.flatMap((node) => (node.data.node.categoryId ? [node.data.node.categoryId] : [])),
      ),
    [treeNodes],
  );
  const relationEdges = useMemo(
    () => buildDomainRelations(thoughts, visibleCategoryIds),
    [thoughts, visibleCategoryIds],
  );
  const relationIndex = useMemo(() => buildRelationIndex(relationEdges), [relationEdges]);
  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of relationEdges) {
      const count = Number((edge.data as { count?: number } | undefined)?.count ?? 0);
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + count);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + count);
    }
    return counts;
  }, [relationEdges]);
  const nodes = useMemo(
    () =>
      treeNodes.map((node) => ({
        ...node,
        data: { ...node.data, relatedCount: relationCounts.get(node.id) ?? 0 },
      })),
    [treeNodes, relationCounts],
  );
  const edges = useMemo(
    () => [
      ...relationEdges,
      ...treeEdges.map((edge) => ({
        ...edge,
        className: "overview-tree-edge",
      })),
    ],
    [relationEdges, treeEdges],
  );
  const handleNodeMouseEnter = useCallback(
    (_: MouseEvent, node: DomainFlowNode) => {
      if (rootRef.current) applyHover(rootRef.current, node.id, relationIndex);
    },
    [relationIndex],
  );
  const handleNodeMouseLeave = useCallback(() => {
    if (rootRef.current) clearHover(rootRef.current);
  }, []);
  const handlePaneMouseEnter = useCallback(() => {
    if (rootRef.current) clearHover(rootRef.current);
  }, []);

  const handleNodeClick = useCallback(
    (_: MouseEvent, node: DomainFlowNode) => {
      if (node.data.node.categoryId) onSelectCategory(node.data.node.categoryId);
    },
    [onSelectCategory],
  );

  return (
    <div ref={rootRef} className="contemplate-overview absolute inset-0 bg-background">
      <ReactFlow
        colorMode="system"
        className="bg-background text-foreground"
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneMouseEnter={handlePaneMouseEnter}
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
