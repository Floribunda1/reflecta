import type { ThoughtSummaryDTO } from "@shared/thought";
import type { GraphColors } from "./colors";

export interface G6NodeData {
  id: string;
  data: {
    thoughtType: string;
    title: string;
    body: string;
    inDegree: number;
  };
  style: {
    size: number;
    fill: string;
    stroke: string;
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

/**
 * Builds G6-compatible graph data from a flat list of thoughts.
 * Node sizes are driven by in-degree.
 */
export function buildG6Data(items: ThoughtSummaryDTO[], colors: GraphColors): G6Data {
  if (!items.length) return { nodes: [], edges: [] };

  const nodeIds = new Set(items.map((t) => t.id));

  // t.connections contains ALL connections involving t (source OR target), so each
  // connection row appears in two thoughts' lists — deduplicate before counting.
  // "A 引用 B" → DB: sourceId=A, targetId=B → graph edge: B→A.
  // Graph in-degree (incoming arrows) of A = how many thoughts A references.
  // More incoming arrows → bigger node.
  const seenConns = new Set<string>();
  const inDegreeMap = new Map<string, number>();
  const validEdges: Array<{ id: string; source: string; target: string }> = [];
  for (const t of items) {
    for (const conn of t.connections) {
      const key = `${conn.sourceId}->${conn.targetId}`;
      if (seenConns.has(key)) continue;
      if (!nodeIds.has(conn.sourceId) || !nodeIds.has(conn.targetId)) continue;
      seenConns.add(key);
      // B (被引用, targetId) → A (引用方, sourceId)
      validEdges.push({ id: key, source: conn.targetId, target: conn.sourceId });
      // A (conn.sourceId) receives the arrow → count its graph in-degree
      inDegreeMap.set(conn.sourceId, (inDegreeMap.get(conn.sourceId) ?? 0) + 1);
    }
  }

  const nodes: G6NodeData[] = items.map((t) => {
    const isIdea = t.type !== "insight";
    const inDeg = inDegreeMap.get(t.id) ?? 0;
    const size = Math.min(24 + inDeg * 7, 64);
    return {
      id: t.id,
      data: {
        thoughtType: t.type,
        title: t.title ?? "",
        body: t.body ?? "",
        inDegree: inDeg,
      },
      style: {
        size,
        fill: isIdea ? colors.ideaFill : colors.insightFill,
        stroke: isIdea ? colors.ideaStroke : colors.insightStroke,
        labelText: truncateLabel(t.title || t.body || ""),
      },
    };
  });

  return { nodes, edges: validEdges };
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
