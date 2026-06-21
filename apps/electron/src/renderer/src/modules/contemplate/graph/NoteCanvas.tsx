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
import { layoutDagreGraph, type DagreLayoutEdge } from "./dagre-layout";

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

function layoutNodes(
  thoughts: ThoughtSummaryDTO[],
  links: Link[],
  focusIds: Set<string>,
  categories: Category[],
  selectedThoughtId: string | null,
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const thoughtById = new Map(thoughts.map((thought) => [thought.id, thought]));
  const categoryByThoughtId = new Map(
    thoughts.map((thought) => [thought.id, thought.categoryIds[0] ?? "uncategorized"]),
  );

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

  const groupedIds = new Map<string, string[]>();
  for (const thought of thoughts) {
    const categoryId = thought.categoryIds[0] ?? "uncategorized";
    groupedIds.set(categoryId, [...(groupedIds.get(categoryId) ?? []), thought.id]);
  }

  const groups = [...groupedIds.entries()].map(([categoryId, ids], index) => {
    const idSet = new Set(ids);
    const positions = layoutDagreGraph(
      ids.map((id) => ({ id, width: NODE_W, height: NODE_H })),
      links.filter((link) => idSet.has(link.source) && idSet.has(link.target)),
      { rankdir: "LR", nodesep: ROW_GAP, ranksep: COL_GAP },
    );
    const nodes = ids.flatMap((id) => {
      const position = positions.get(id) ?? { x: 0, y: 0 };
      const node = pushNode(id, position.x + LANE_PAD_X, position.y + LANE_PAD_TOP);
      return node ? [node] : [];
    });
    const width = Math.max(...nodes.map((node) => node.position.x + NODE_W), NODE_W) + LANE_PAD_X;
    const height =
      Math.max(...nodes.map((node) => node.position.y + NODE_H), NODE_H) + LANE_PAD_BOTTOM;
    return {
      id: categoryId,
      nodes,
      lane: {
        id: `category:${index}:${categoryId}`,
        label: categoryLabel(categoryId),
        breadcrumb: categoryBreadcrumb(categoryId),
        count: nodes.length,
        external: nodes.every((node) => node.data.kind === "note" && node.data.external),
        x: 0,
        y: 0,
        width,
        height,
      } satisfies LaneBox,
    };
  });

  const groupEdgeKeys = new Set<string>();
  const groupEdges: DagreLayoutEdge[] = [];
  for (const link of links) {
    const source = categoryByThoughtId.get(link.source);
    const target = categoryByThoughtId.get(link.target);
    if (!source || !target || source === target) continue;
    const key = `${source}->${target}`;
    if (groupEdgeKeys.has(key)) continue;
    groupEdgeKeys.add(key);
    groupEdges.push({ source, target });
  }

  const groupPositions = layoutDagreGraph(
    groups.map((group) => ({ id: group.id, width: group.lane.width, height: group.lane.height })),
    groupEdges,
    { rankdir: "LR", nodesep: GROUP_GAP_Y, ranksep: GROUP_GAP_X },
  );
  const nodes: NoteFlowNode[] = [];
  const lanes: LaneBox[] = [];
  for (const group of groups) {
    const offset = groupPositions.get(group.id) ?? { x: 0, y: 0 };
    lanes.push({ ...group.lane, x: offset.x, y: offset.y });
    nodes.push(
      ...group.nodes.map((node) => ({
        ...node,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
      })),
    );
  }

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
