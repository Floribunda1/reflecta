import type { ThoughtSummaryDTO } from "@shared/thought";
import type { GraphStatusFilter } from "../context";
import type { GraphColors } from "./colors";

export interface G6NodeData {
  id: string;
  data: {
    title: string;
    body: string;
    contextCount: number;
    connectionCount: number;
    hasContext: boolean;
    isIsolated: boolean;
  };
  style: {
    size: number;
    fill: string;
    stroke: string;
    lineDash?: number[];
    labelText: string;
    x?: number;
    y?: number;
  };
}

export interface G6EdgeData {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface G6Data {
  nodes: G6NodeData[];
  edges: G6EdgeData[];
}

type VisibleGraphFacts = {
  edges: G6EdgeData[];
  neighborIdsByThoughtId: Map<string, Set<string>>;
};

function buildVisibleGraphFacts(items: ThoughtSummaryDTO[]): VisibleGraphFacts {
  const nodeIds = new Set(items.map((thought) => thought.id));
  const neighborIdsByThoughtId = new Map<string, Set<string>>();
  const seenConns = new Set<string>();
  const edges: G6EdgeData[] = [];

  for (const thought of items) {
    neighborIdsByThoughtId.set(thought.id, new Set());
  }

  for (const thought of items) {
    for (const targetId of thought.connectionIds) {
      if (targetId === thought.id) continue;
      if (!nodeIds.has(targetId)) continue;

      const key = `${thought.id}->${targetId}`;
      if (seenConns.has(key)) continue;

      seenConns.add(key);
      edges.push({ id: key, source: thought.id, target: targetId });
      neighborIdsByThoughtId.get(thought.id)?.add(targetId);
      neighborIdsByThoughtId.get(targetId)?.add(thought.id);
    }
  }

  return { edges, neighborIdsByThoughtId };
}

function getNodeStyle(thought: ThoughtSummaryDTO, connectionCount: number, colors: GraphColors) {
  const hasContext = thought.contextCount > 0;
  const isIsolated = connectionCount === 0;

  return {
    fill: hasContext ? colors.nodeFill : colors.noContextFill,
    stroke: hasContext ? colors.nodeStroke : colors.noContextStroke,
    lineDash: isIsolated ? [5, 4] : undefined,
  };
}

/** Builds G6-compatible graph data from visible thoughts and confirmed connections. */
export function buildG6Data(items: ThoughtSummaryDTO[], colors: GraphColors): G6Data {
  if (!items.length) return { nodes: [], edges: [] };

  const { edges, neighborIdsByThoughtId } = buildVisibleGraphFacts(items);

  const nodes: G6NodeData[] = items.map((t) => {
    const connectionCount = neighborIdsByThoughtId.get(t.id)?.size ?? 0;
    const hasContext = t.contextCount > 0;
    const isIsolated = connectionCount === 0;
    const nodeStyle = getNodeStyle(t, connectionCount, colors);

    return {
      id: t.id,
      data: {
        title: t.title ?? "",
        body: t.body ?? "",
        contextCount: t.contextCount,
        connectionCount,
        hasContext,
        isIsolated,
      },
      style: {
        size: 34,
        fill: nodeStyle.fill,
        stroke: nodeStyle.stroke,
        lineDash: nodeStyle.lineDash,
        labelText: truncateLabel(t.title || t.body || "", 18),
      },
    };
  });

  return { nodes, edges };
}

export function filterThoughtsByStatus(
  items: ThoughtSummaryDTO[],
  statusFilter: GraphStatusFilter,
): ThoughtSummaryDTO[] {
  if (statusFilter === "all" || items.length === 0) return items;

  const { neighborIdsByThoughtId } = buildVisibleGraphFacts(items);

  return items.filter((thought) => {
    const connectionCount = neighborIdsByThoughtId.get(thought.id)?.size ?? 0;

    switch (statusFilter) {
      case "with-context":
        return thought.contextCount > 0;
      case "without-context":
        return thought.contextCount === 0;
      case "connected":
        return connectionCount > 0;
      case "isolated":
        return connectionCount === 0;
    }
  });
}

/** Returns IDs of all direct neighbors (both edge directions) for a node. */
export function getNeighborIds(nodeId: string, data: G6Data): Set<string> {
  const ids = new Set<string>();
  for (const e of data.edges) {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  }
  return ids;
}

function truncateLabel(text: string, max = 12): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
