import { useMemo } from "react";
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
import "@xyflow/react/dist/style.css";
import type { Category } from "@shared/category";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { cn } from "@renderer/lib/utils";

type NoteNodeData = {
  kind: "note";
  thought: ThoughtSummaryDTO;
  title: string;
  excerpt: string;
  categoryLabel: string;
  external: boolean;
  selected: boolean;
};

type GroupNodeData = {
  kind: "group";
  label: string;
  breadcrumb: string;
  count: number;
  external: boolean;
  width: number;
  height: number;
};

type NoteCanvasNodeData = NoteNodeData | GroupNodeData;

type NoteFlowNode = Node<NoteCanvasNodeData, "note" | "categoryGroup">;

type Link = {
  source: string;
  target: string;
};

type LaneBox = {
  id: string;
  label: string;
  breadcrumb: string;
  count: number;
  external: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutResult = {
  nodes: NoteFlowNode[];
  lanes: LaneBox[];
};

const NODE_W = 300;
const NODE_H = 156;
const COL_GAP = 150;
const ROW_GAP = 48;
const GROUP_GAP_X = 120;
const GROUP_GAP_Y = 110;
const LANE_PAD_X = 30;
const LANE_PAD_TOP = 42;
const LANE_PAD_BOTTOM = 28;

function edgeMarker(color: string) {
  return {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color,
  };
}

function titleForThought(thought: ThoughtSummaryDTO) {
  const title = thought.title?.trim();
  if (title) return title;
  return (
    thought.body
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || "未命名理解"
  );
}

function excerptForThought(thought: ThoughtSummaryDTO) {
  const body = thought.body.replace(/\s+/g, " ").trim();
  if (!body) return "暂无正文。";
  return body.length > 132 ? `${body.slice(0, 132)}...` : body;
}

function buildLinks(thoughts: ThoughtSummaryDTO[]): Link[] {
  const ids = new Set(thoughts.map((thought) => thought.id));
  const seen = new Set<string>();
  const links: Link[] = [];

  for (const thought of thoughts) {
    for (const targetId of thought.connectionIds) {
      if (!ids.has(targetId) || targetId === thought.id) continue;
      const key = `${thought.id}->${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: thought.id, target: targetId });
    }
  }

  return links;
}

function connectedComponents(thoughts: ThoughtSummaryDTO[], links: Link[]) {
  const adjacency = new Map(thoughts.map((thought) => [thought.id, [] as string[]]));
  for (const link of links) {
    adjacency.get(link.source)?.push(link.target);
    adjacency.get(link.target)?.push(link.source);
  }

  const seen = new Set<string>();
  const components: string[][] = [];
  for (const thought of thoughts) {
    if (seen.has(thought.id)) continue;
    const queue = [thought.id];
    const ids: string[] = [];
    seen.add(thought.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      ids.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    components.push(ids);
  }

  return components.sort((a, b) => b.length - a.length);
}

function dagRanks(ids: string[], links: Link[]) {
  const idSet = new Set(ids);
  const rank = new Map(ids.map((id) => [id, 0]));
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));

  for (const link of links) {
    if (!idSet.has(link.source) || !idSet.has(link.target)) continue;
    outgoing.get(link.source)?.push(link.target);
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
  }

  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited.add(id);
    for (const next of outgoing.get(id) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(id) ?? 0) + 1));
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if ((indegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }

  // ponytail: cycles fall back to degree order; add SCC ranking if cyclic graphs become common.
  for (const id of ids) {
    if (!visited.has(id)) rank.set(id, Math.min(rank.get(id) ?? 0, 2));
  }

  return rank;
}

function layoutNodes(
  thoughts: ThoughtSummaryDTO[],
  links: Link[],
  focusIds: Set<string>,
  categories: Category[],
  selectedThoughtId: string | null,
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const thoughtById = new Map(thoughts.map((thought) => [thought.id, thought]));
  const components = connectedComponents(thoughts, links);
  const blocks: LayoutResult[] = [];
  const isolatedIds: string[] = [];

  const pushNode = (id: string, x: number, y: number) => {
    const thought = thoughtById.get(id);
    if (!thought) return null;
    const categoryId = thought.categoryIds[0];
    const categoryLabel = categoryId ? categoryBreadcrumb(categoryId) : "未归类";
    return {
      id,
      type: "note",
      position: { x, y },
      width: NODE_W,
      height: NODE_H,
      data: {
        kind: "note",
        thought,
        title: titleForThought(thought),
        excerpt: excerptForThought(thought),
        categoryLabel,
        external: !focusIds.has(id),
        selected: selectedThoughtId === id,
      },
    } satisfies NoteFlowNode;
  };

  function categoryLabel(categoryId: string) {
    if (categoryId === "uncategorized") return "未归类";
    return categoryById.get(categoryId)?.name ?? "未命名 Category";
  }

  function categoryBreadcrumb(categoryId: string) {
    const names: string[] = [];
    const seen = new Set<string>();
    let current = categoryById.get(categoryId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? categoryById.get(current.parentId) : undefined;
    }
    return names.join(" / ") || "未命名 Category";
  }

  function laneBoxes(nodes: NoteFlowNode[], prefix: string): LaneBox[] {
    const boxes = new Map<
      string,
      {
        label: string;
        external: boolean;
        count: number;
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      }
    >();

    for (const node of nodes) {
      if (node.data.kind !== "note") continue;
      const key = node.data.categoryLabel;
      const current = boxes.get(key) ?? {
        label: key,
        external: true,
        count: 0,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };
      current.external = current.external && node.data.external;
      current.count += 1;
      current.minX = Math.min(current.minX, node.position.x);
      current.minY = Math.min(current.minY, node.position.y);
      current.maxX = Math.max(current.maxX, node.position.x + NODE_W);
      current.maxY = Math.max(current.maxY, node.position.y + NODE_H);
      boxes.set(key, current);
    }

    return [...boxes.values()].map((box, index) => ({
      id: `${prefix}:${index}:${box.label}`,
      label: box.label,
      breadcrumb: box.label,
      count: box.count,
      external: box.external,
      x: box.minX - LANE_PAD_X,
      y: box.minY - LANE_PAD_TOP,
      width: box.maxX - box.minX + LANE_PAD_X * 2,
      height: box.maxY - box.minY + LANE_PAD_TOP + LANE_PAD_BOTTOM,
    }));
  }

  function offsetLayout(layout: LayoutResult, x: number, y: number): LayoutResult {
    return {
      nodes: layout.nodes.map((node) => ({
        ...node,
        position: { x: node.position.x + x, y: node.position.y + y },
      })),
      lanes: layout.lanes.map((lane) => ({ ...lane, x: lane.x + x, y: lane.y + y })),
    };
  }

  function layoutRelationBlock(ids: string[], blockIndex: number): LayoutResult {
    const idSet = new Set(ids);
    const componentLinks = links.filter((link) => idSet.has(link.source) && idSet.has(link.target));
    const ranks = dagRanks(ids, componentLinks);
    const categoryOrder = [
      ...new Set(ids.map((id) => thoughtById.get(id)?.categoryIds[0] ?? "uncategorized")),
    ].sort((a, b) => {
      const aFocus = ids.filter(
        (id) => focusIds.has(id) && thoughtById.get(id)?.categoryIds[0] === a,
      ).length;
      const bFocus = ids.filter(
        (id) => focusIds.has(id) && thoughtById.get(id)?.categoryIds[0] === b,
      ).length;
      return bFocus - aFocus;
    });
    const laneY = new Map<string, number>();
    let componentHeight = 0;

    for (const categoryId of categoryOrder) {
      const categoryIds = ids.filter(
        (id) => (thoughtById.get(id)?.categoryIds[0] ?? "uncategorized") === categoryId,
      );
      const byRank = new Map<number, string[]>();
      for (const id of categoryIds) {
        const rank = ranks.get(id) ?? 0;
        byRank.set(rank, [...(byRank.get(rank) ?? []), id]);
      }
      const rows = Math.max(...[...byRank.values()].map((items) => items.length), 1);
      laneY.set(categoryId, componentHeight);
      componentHeight += rows * (NODE_H + ROW_GAP) + GROUP_GAP_Y;
    }

    const blockNodes: NoteFlowNode[] = [];
    const rankRows = new Map<string, Map<number, number>>();
    for (const id of ids) {
      const categoryId = thoughtById.get(id)?.categoryIds[0] ?? "uncategorized";
      const rank = ranks.get(id) ?? 0;
      const rows = rankRows.get(categoryId) ?? new Map<number, number>();
      const row = rows.get(rank) ?? 0;
      rows.set(rank, row + 1);
      rankRows.set(categoryId, rows);
      const node = pushNode(
        id,
        rank * (NODE_W + COL_GAP),
        (laneY.get(categoryId) ?? 0) + row * (NODE_H + ROW_GAP),
      );
      if (node) blockNodes.push(node);
    }

    blockNodes.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    return { nodes: blockNodes, lanes: laneBoxes(blockNodes, `relation:${blockIndex}`) };
  }

  for (const ids of components) {
    const idSet = new Set(ids);
    const hasLink = links.some((link) => idSet.has(link.source) && idSet.has(link.target));
    if (hasLink) blocks.push(layoutRelationBlock(ids, blocks.length));
    else isolatedIds.push(...ids);
  }

  const isolatedByCategory = new Map<string, string[]>();
  for (const id of isolatedIds) {
    const categoryId = thoughtById.get(id)?.categoryIds[0] ?? "uncategorized";
    isolatedByCategory.set(categoryId, [...(isolatedByCategory.get(categoryId) ?? []), id]);
  }

  [...isolatedByCategory.entries()]
    .sort(([, a], [, b]) => b.length - a.length)
    .forEach(([categoryId, ids]) => {
      const blockNodes: NoteFlowNode[] = [];
      const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(ids.length))));
      ids.forEach((id, index) => {
        const node = pushNode(
          id,
          (index % cols) * (NODE_W + COL_GAP),
          Math.floor(index / cols) * (NODE_H + ROW_GAP),
        );
        if (node) blockNodes.push(node);
      });
      blocks.push({
        nodes: blockNodes,
        lanes: laneBoxes(blockNodes, `isolated:${categoryLabel(categoryId)}`),
      });
    });

  const blockSizes = blocks.map((block) => ({
    width: Math.max(...block.lanes.map((lane) => lane.x + lane.width), NODE_W),
    height: Math.max(...block.lanes.map((lane) => lane.y + lane.height), NODE_H),
  }));
  const columnCount = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(blocks.length))));
  const columnWidth = Math.max(...blockSizes.map((size) => size.width), NODE_W) + GROUP_GAP_X;
  const columnHeights = Array.from({ length: columnCount }, () => -260);
  const nodes: NoteFlowNode[] = [];
  const lanes: LaneBox[] = [];

  blocks.forEach((block, index) => {
    const col = columnHeights.indexOf(Math.min(...columnHeights));
    const x = col * columnWidth;
    const y = columnHeights[col];
    const placed = offsetLayout(block, x, y);
    nodes.push(...placed.nodes);
    lanes.push(...placed.lanes);
    columnHeights[col] += blockSizes[index].height + GROUP_GAP_Y;
  });

  return { nodes, lanes };
}

function addGroupNodes(layout: LayoutResult): NoteFlowNode[] {
  const groupNodes: NoteFlowNode[] = layout.lanes.map((lane) => {
    return {
      id: `group:${lane.id}`,
      type: "categoryGroup",
      position: {
        x: lane.x,
        y: lane.y,
      },
      width: lane.width,
      height: lane.height,
      selectable: false,
      draggable: false,
      focusable: false,
      data: {
        kind: "group",
        label: lane.label,
        breadcrumb: lane.breadcrumb,
        count: lane.count,
        external: lane.external,
        width: lane.width,
        height: lane.height,
      },
    };
  });

  return [...groupNodes, ...layout.nodes];
}

function buildEdges(
  links: Link[],
  focusIds: Set<string>,
  selectedThoughtId: string | null,
): Edge[] {
  return links.map((link) => {
    const crossDomain = focusIds.has(link.source) !== focusIds.has(link.target);
    const active = selectedThoughtId === link.source || selectedThoughtId === link.target;
    const stroke = active ? "var(--primary)" : crossDomain ? "var(--ring)" : "var(--border)";
    return {
      id: `${link.source}->${link.target}`,
      source: link.source,
      target: link.target,
      type: "smoothstep",
      animated: active,
      markerStart: edgeMarker(stroke),
      style: {
        stroke,
        strokeWidth: active ? 2.5 : crossDomain ? 1.8 : 1.25,
        opacity: active ? 0.9 : crossDomain ? 0.58 : 0.34,
        strokeDasharray: crossDomain ? "6 5" : undefined,
      },
    };
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

function NoteCard({ data }: NodeProps<Node<NoteNodeData, "note">>) {
  return (
    <button
      type="button"
      className={cn(
        "w-[300px] rounded-md border border-border bg-card px-4 py-3 text-left text-card-foreground shadow-xs transition-colors",
        data.external && "border-dashed bg-muted/30 text-muted-foreground shadow-none",
        data.selected && "border-primary ring-2 ring-ring/30",
      )}
    >
      <HiddenHandles />
      <div className="flex items-start gap-2">
        <div className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-5">
          {data.title}
        </div>
        {!data.thought.contextCount && <span className="mt-1 size-2 rounded-full bg-amber-500" />}
      </div>
      <div className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
        {data.excerpt}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{data.categoryLabel}</span>
        {data.external && (
          <>
            <span aria-hidden>·</span>
            <span>外部引用</span>
          </>
        )}
      </div>
    </button>
  );
}

function GroupBox({ data }: NodeProps<Node<GroupNodeData, "categoryGroup">>) {
  return (
    <div
      className={cn(
        "nodrag nopan pointer-events-none rounded-lg border border-border bg-muted/20 shadow-xs dark:bg-muted/10",
        data.external && "border-dashed bg-muted/10 shadow-none",
      )}
      style={{ width: data.width, height: data.height }}
    >
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
        {data.breadcrumb} · {data.count}
      </div>
    </div>
  );
}

const NODE_TYPES = { note: NoteCard, categoryGroup: GroupBox };

function miniMapNodeColor(node: NoteFlowNode) {
  if (node.data.kind === "group") return "transparent";
  if (node.data.selected) return "var(--primary)";
  return node.data.external ? "var(--muted-foreground)" : "var(--primary)";
}

function miniMapNodeStrokeColor(node: NoteFlowNode) {
  if (node.data.kind === "group") return "transparent";
  if (node.data.selected) return "var(--primary)";
  return node.data.external ? "var(--muted-foreground)" : "var(--primary)";
}

export function NoteCanvas({
  thoughts,
  focusThoughts,
  categories,
  selectedThoughtId,
  onSelectThought,
}: {
  thoughts: ThoughtSummaryDTO[];
  focusThoughts: ThoughtSummaryDTO[];
  categories: Category[];
  selectedThoughtId: string | null;
  onSelectThought: (id: string | null) => void;
}) {
  const focusIds = useMemo(
    () => new Set(focusThoughts.map((thought) => thought.id)),
    [focusThoughts],
  );
  const links = useMemo(() => buildLinks(thoughts), [thoughts]);
  const nodes = useMemo(
    () => addGroupNodes(layoutNodes(thoughts, links, focusIds, categories, selectedThoughtId)),
    [thoughts, links, focusIds, categories, selectedThoughtId],
  );
  const edges = useMemo(
    () => buildEdges(links, focusIds, selectedThoughtId),
    [links, focusIds, selectedThoughtId],
  );

  return (
    <ReactFlow
      colorMode="system"
      className="bg-background text-foreground"
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_, node) => {
        if (node.data.kind === "note") onSelectThought(node.id);
      }}
      onPaneClick={() => onSelectThought(null)}
      fitView
      fitViewOptions={{ padding: 0.24 }}
      minZoom={0.2}
      maxZoom={1.8}
      nodesDraggable
      elementsSelectable
      proOptions={{ hideAttribution: true }}
    >
      <Background color="var(--border)" gap={40} size={1} />
      <Controls position="bottom-left" />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        nodeColor={miniMapNodeColor}
        nodeStrokeColor={miniMapNodeStrokeColor}
        nodeBorderRadius={4}
        maskColor="color-mix(in srgb, var(--background), transparent 25%)"
        bgColor="var(--background)"
      />
    </ReactFlow>
  );
}
