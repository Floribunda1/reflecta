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
        <div className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {countLabel}
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
  const atlas = buildAtlas(categories, thoughts);
  const { nodes, edges } = layoutTree(atlas);

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
